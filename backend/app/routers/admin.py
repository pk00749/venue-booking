from fastapi import APIRouter, Depends, HTTPException, Header
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

from app.models.models import (
    User, UserRole, OwnerApplication, OwnerApplicationStatus
)
from app.routers.auth import get_current_user
from app.database import get_collection

router = APIRouter()


def require_admin(user: User = Depends(get_current_user)):
    """要求管理员权限"""
    if UserRole.ADMIN not in user.roles:
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user


@router.get("/users", response_model=List[User])
async def list_users(
    skip: int = 0,
    limit: int = 50,
    user: User = Depends(require_admin)
):
    """获取所有用户列表（管理员）"""
    users_col = get_collection("users")
    cursor = users_col.find().skip(skip).limit(limit)
    
    users = []
    async for doc in cursor:
        # 兼容旧数据
        if "role" in doc and "roles" not in doc:
            old_role = doc.pop("role")
            doc["roles"] = [old_role] if old_role else [UserRole.USER]
        doc["id"] = str(doc.pop("_id"))
        users.append(User(**doc))
    
    return users


@router.put("/users/{user_id}/role")
async def set_user_role(
    user_id: str,
    role: UserRole,
    action: str = "add",  # "add" 添加角色，"remove" 移除角色
    admin: User = Depends(require_admin)
):
    """设置用户角色（管理员）"""
    users_col = get_collection("users")
    
    # 查找目标用户
    try:
        target_doc = await users_col.find_one({"_id": ObjectId(user_id)})
    except Exception:
        target_doc = await users_col.find_one({"_id": user_id})
    
    if not target_doc:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    # 兼容旧数据
    if "role" in target_doc and "roles" not in target_doc:
        old_role = target_doc.pop("role")
        target_doc["roles"] = [old_role] if old_role else [UserRole.USER]
    
    current_roles = [UserRole(r) for r in target_doc.get("roles", [UserRole.USER.value])]
    
    if action == "add":
        if role not in current_roles:
            current_roles.append(role)
        message = f"已添加 {role.value} 角色"
    elif action == "remove":
        if role in current_roles:
            # 确保至少保留一个 user 角色
            other_roles = [r for r in current_roles if r != role]
            if not other_roles:
                other_roles = [UserRole.USER]
            current_roles = other_roles
        message = f"已移除 {role.value} 角色"
    else:
        raise HTTPException(status_code=400, detail="无效的 action")
    
    # 更新用户角色
    await users_col.update_one(
        {"_id": target_doc["_id"]},
        {"$set": {"roles": [r.value for r in current_roles]}}
    )
    
    return {"message": message, "user_id": user_id, "roles": [r.value for r in current_roles]}


@router.get("/owner-applications", response_model=List[OwnerApplication])
async def list_owner_applications(
    status: Optional[OwnerApplicationStatus] = None,
    skip: int = 0,
    limit: int = 50,
    user: User = Depends(require_admin)
):
    """获取场主申请列表（管理员）"""
    apps_col = get_collection("owner_applications")
    query = {}
    if status:
        query["status"] = status
    
    cursor = apps_col.find(query).skip(skip).limit(limit).sort("created_at", -1)
    
    applications = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        applications.append(OwnerApplication(**doc))
    
    return applications


@router.put("/owner-applications/{application_id}/review")
async def review_owner_application(
    application_id: str,
    approved: bool,
    admin_note: Optional[str] = None,
    admin: User = Depends(require_admin)
):
    """审核场主申请（管理员）"""
    apps_col = get_collection("owner_applications")
    users_col = get_collection("users")
    
    # 查找申请
    try:
        app_doc = await apps_col.find_one({"_id": ObjectId(application_id)})
    except Exception:
        app_doc = await apps_col.find_one({"_id": application_id})
    
    if not app_doc:
        raise HTTPException(status_code=404, detail="申请不存在")
    
    if app_doc["status"] != OwnerApplicationStatus.PENDING:
        raise HTTPException(status_code=400, detail="该申请已处理")
    
    new_status = OwnerApplicationStatus.APPROVED if approved else OwnerApplicationStatus.REJECTED
    
    # 更新申请状态
    await apps_col.update_one(
        {"_id": app_doc["_id"]},
        {"$set": {
            "status": new_status,
            "reviewed_at": datetime.utcnow(),
            "reviewed_by": admin.id,
            "admin_note": admin_note
        }}
    )
    
    # 如果批准，将 owner 角色添加到用户
    if approved:
        try:
            target_doc = await users_col.find_one({"_id": ObjectId(app_doc["user_id"])})
        except Exception:
            target_doc = await users_col.find_one({"_id": app_doc["user_id"]})
        
        if target_doc:
            # 兼容旧数据
            if "role" in target_doc and "roles" not in target_doc:
                old_role = target_doc.pop("role")
                target_doc["roles"] = [old_role] if old_role else [UserRole.USER]
            
            current_roles = [UserRole(r) for r in target_doc.get("roles", [UserRole.USER.value])]
            if UserRole.OWNER not in current_roles:
                current_roles.append(UserRole.OWNER)
            
            await users_col.update_one(
                {"_id": target_doc["_id"]},
                {"$set": {"roles": [r.value for r in current_roles]}}
            )
    
    return {
        "message": "已批准" if approved else "已拒绝",
        "application_id": application_id,
        "status": new_status
    }
