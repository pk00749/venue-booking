from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Optional, List
import httpx
from datetime import datetime, timedelta
from jose import JWTError, jwt
from bson import ObjectId

from app.config import get_settings
from app.models.models import (
    WeChatLoginRequest, WeChatLoginResponse, User, UserCreate, TokenData,
    UserRole, OwnerApplication, OwnerApplicationStatus
)
from app.database import get_collection

router = APIRouter()
settings = get_settings()


def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode = {"sub": user_id, "exp": expire}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None


async def get_current_user(authorization: Optional[str] = Header(None)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未登录")
    
    token = authorization.replace("Bearer ", "")
    user_id = verify_token(token)
    
    if not user_id:
        raise HTTPException(status_code=401, detail="无效的token")
    
    users_col = get_collection("users")
    try:
        user_doc = await users_col.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user_doc = await users_col.find_one({"_id": user_id})
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="用户不存在")
    
    # 兼容旧数据：如果是单个 role 字段，转为 roles 列表
    if "role" in user_doc and "roles" not in user_doc:
        old_role = user_doc.pop("role")
        user_doc["roles"] = [old_role] if old_role else [UserRole.USER]
        # 写回数据库，保持一致性
        await users_col.update_one({"_id": user_doc["_id"]}, {"$set": {"roles": user_doc["roles"]}})
    
    user_doc["id"] = str(user_doc.pop("_id"))
    return User(**user_doc)


def require_roles(*roles: UserRole):
    """角色检查依赖，支持多角色"""
    async def role_checker(user: User = Depends(get_current_user)):
        user_role_values = [r.value for r in user.roles]
        if not any(r.value in user_role_values for r in roles):
            raise HTTPException(status_code=403, detail="权限不足")
        return user
    return role_checker


@router.post("/wechat", response_model=WeChatLoginResponse)
async def wechat_login(request: WeChatLoginRequest):
    """微信授权登录"""
    # 1. 用 code 换取 openid
    async with httpx.AsyncClient() as client:
        url = "https://api.weixin.qq.com/sns/jscode2session"
        params = {
            "appid": settings.WECHAT_APPID,
            "secret": settings.WECHAT_SECRET,
            "js_code": request.code,
            "grant_type": "authorization_code"
        }
        resp = await client.get(url, params=params)
        data = resp.json()
    
    if "errcode" in data:
        raise HTTPException(status_code=400, detail=f"微信登录失败: {data.get('errmsg')}")
    
    openid = data["openid"]
    
    # 2. 查找或创建用户
    users_col = get_collection("users")
    user_doc = await users_col.find_one({"openid": openid})
    
    is_new_user = False
    if not user_doc:
        # 创建新用户
        user_id = str(ObjectId())
        new_user = UserCreate(openid=openid)
        user_dict = new_user.model_dump()
        user_dict["_id"] = user_id
        user_dict["roles"] = [UserRole.USER]
        await users_col.insert_one(user_dict)
        user_doc = await users_col.find_one({"_id": user_id})
        is_new_user = True
    
    # 兼容旧数据
    if "role" in user_doc and "roles" not in user_doc:
        old_role = user_doc.pop("role")
        user_doc["roles"] = [old_role] if old_role else [UserRole.USER]
        await users_col.update_one({"_id": user_id}, {"$set": {"roles": user_doc["roles"]}})
    
    user_doc["id"] = str(user_doc["_id"])
    user = User(**user_doc)
    
    # 3. 生成 token
    token = create_access_token(str(user.id))
    
    return WeChatLoginResponse(
        token=token,
        user=user,
        is_new_user=is_new_user
    )


@router.get("/me", response_model=User)
async def get_me(user: User = Depends(get_current_user)):
    """获取当前用户"""
    return user


@router.put("/me")
async def update_me(
    nickname: Optional[str] = None,
    phone: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """更新用户信息"""
    users_col = get_collection("users")
    update_data = {}
    if nickname:
        update_data["nickname"] = nickname
    if phone:
        update_data["phone"] = phone
    
    if update_data:
        await users_col.update_one(
            {"_id": user.id},
            {"$set": update_data}
        )
    
    return {"message": "更新成功"}


@router.post("/apply-owner")
async def apply_owner(
    reason: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """申请成为场主"""
    # 如果已经是场主或管理员，直接返回
    if UserRole.OWNER in user.roles or UserRole.ADMIN in user.roles:
        return {"message": "您已经是场主或管理员", "status": "already_owner"}
    
    users_col = get_collection("users")
    apps_col = get_collection("owner_applications")
    
    # 检查是否有待处理的申请
    existing = await apps_col.find_one({
        "user_id": user.id,
        "status": OwnerApplicationStatus.PENDING
    })
    if existing:
        return {"message": "您已有待处理的申请", "status": "pending"}
    
    # 创建申请记录（简化流程：直接批准）
    app_id = str(ObjectId())
    app_doc = {
        "_id": app_id,
        "user_id": user.id,
        "status": OwnerApplicationStatus.PENDING,
        "reason": reason,
        "created_at": datetime.utcnow()
    }
    await apps_col.insert_one(app_doc)
    
    # 简化流程：直接升级为场主（实际项目中可以改为审核流程）
    # 将 owner 角色添加到用户的 roles 列表
    new_roles = [r for r in user.roles] + [UserRole.OWNER]
    await users_col.update_one(
        {"_id": user.id},
        {"$set": {"roles": [r.value for r in new_roles]}}
    )
    
    # 更新申请状态为已批准
    await apps_col.update_one(
        {"_id": app_id},
        {"$set": {
            "status": OwnerApplicationStatus.APPROVED,
            "reviewed_at": datetime.utcnow(),
            "admin_note": "系统自动批准"
        }}
    )
    
    return {
        "message": "已升级为场主",
        "status": "approved",
        "application_id": app_id
    }


@router.get("/my-applications")
async def get_my_applications(user: User = Depends(get_current_user)):
    """获取我提交的场主申请"""
    apps_col = get_collection("owner_applications")
    cursor = apps_col.find({"user_id": user.id}).sort("created_at", -1)
    
    applications = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        applications.append(doc)
    
    return applications
