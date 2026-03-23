from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId

from app.models.models import (
    Venue, VenueCreate, VenueType, Slot, SlotCreate, User, UserRole
)
from app.routers.auth import get_current_user
from app.database import get_collection

router = APIRouter()


# ============ 公开接口（用户） ============

@router.get("", response_model=List[Venue])
async def list_venues(
    type: Optional[VenueType] = None,
    keyword: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100)
):
    """场地列表"""
    venues_col = get_collection("venues")
    query = {"status": "active"}

    if type:
        query["type"] = type
    if keyword:
        query["$or"] = [
            {"name": {"$regex": keyword, "$options": "i"}},
            {"address": {"$regex": keyword, "$options": "i"}}
        ]

    cursor = venues_col.find(query).skip(skip).limit(limit)
    venues = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        venues.append(Venue(**doc))

    return venues


@router.get("/{venue_id}", response_model=Venue)
async def get_venue(venue_id: str):
    """场地详情"""
    venues_col = get_collection("venues")
    doc = await venues_col.find_one({"_id": ObjectId(venue_id), "status": "active"})

    if not doc:
        raise HTTPException(status_code=404, detail="场地不存在")

    doc["id"] = str(doc.pop("_id"))
    return Venue(**doc)


@router.get("/{venue_id}/slots")
async def get_venue_slots(
    venue_id: str,
    date: str,  # YYYY-MM-DD
):
    """获取场地某天的时段"""
    slots_col = get_collection("slots")
    cursor = slots_col.find({"venue_id": venue_id, "date": date})

    slots = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        slots.append(doc)

    return slots


# ============ 场主接口 ============

@router.post("", response_model=Venue)
async def create_venue(
    venue: VenueCreate,
    user: User = Depends(get_current_user)
):
    """创建场地（场主）"""
    user_role_values = [r.value for r in user.roles]
    if not any(r in user_role_values for r in [UserRole.OWNER.value, UserRole.ADMIN.value]):
        raise HTTPException(status_code=403, detail="需要场主权限")

    venues_col = get_collection("venues")
    venue_dict = venue.model_dump()
    venue_dict["owner_id"] = user.id
    venue_dict["status"] = "active"
    venue_dict["created_at"] = datetime.utcnow()

    result = await venues_col.insert_one(venue_dict)
    venue_dict["id"] = str(result.inserted_id)

    return Venue(**venue_dict)


@router.put("/{venue_id}", response_model=Venue)
async def update_venue(
    venue_id: str,
    venue: VenueCreate,
    user: User = Depends(get_current_user)
):
    """更新场地"""
    user_role_values = [r.value for r in user.roles]
    is_admin = UserRole.ADMIN.value in user_role_values

    venues_col = get_collection("venues")
    existing = await venues_col.find_one({"_id": ObjectId(venue_id)})

    if not existing:
        raise HTTPException(status_code=404, detail="场地不存在")

    if existing["owner_id"] != user.id and not is_admin:
        raise HTTPException(status_code=403, detail="无权限")

    await venues_col.update_one(
        {"_id": ObjectId(venue_id)},
        {"$set": venue.model_dump()}
    )

    doc = await venues_col.find_one({"_id": ObjectId(venue_id)})
    doc["id"] = str(doc.pop("_id"))
    return Venue(**doc)


@router.delete("/{venue_id}")
async def delete_venue(venue_id: str, user: User = Depends(get_current_user)):
    """删除场地"""
    user_role_values = [r.value for r in user.roles]
    is_admin = UserRole.ADMIN.value in user_role_values

    venues_col = get_collection("venues")
    existing = await venues_col.find_one({"_id": ObjectId(venue_id)})

    if not existing:
        raise HTTPException(status_code=404, detail="场地不存在")

    if existing["owner_id"] != user.id and not is_admin:
        raise HTTPException(status_code=403, detail="无权限")

    await venues_col.update_one(
        {"_id": ObjectId(venue_id)},
        {"$set": {"status": "deleted"}}
    )

    return {"message": "删除成功"}


@router.post("/{venue_id}/slots/generate")
async def generate_slots(
    venue_id: str,
    start_date: str,  # YYYY-MM-DD
    end_date: str,    # YYYY-MM-DD
    price: Optional[float] = None,
    user: User = Depends(get_current_user)
):
    """生成时段"""
    user_role_values = [r.value for r in user.roles]
    is_admin = UserRole.ADMIN.value in user_role_values

    venues_col = get_collection("venues")
    slots_col = get_collection("slots")

    venue = await venues_col.find_one({"_id": ObjectId(venue_id)})
    if not venue:
        raise HTTPException(status_code=404, detail="场地不存在")

    if venue["owner_id"] != user.id and not is_admin:
        raise HTTPException(status_code=403, detail="无权限")

    # 使用场地默认价格（如果未指定）
    slot_price = price if price is not None else venue.get("slot_price", 50.0)

    # 解析日期
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")

    # 解析开放时间
    open_time = venue.get("open_time", {"start": "08:00", "end": "22:00"})
    slot_duration = venue.get("slot_duration", 60)

    start_hour, start_min = map(int, open_time["start"].split(":"))
    end_hour, end_min = map(int, open_time["end"].split(":"))

    # 生成每天的时段
    current_date = start
    slots_created = 0

    while current_date <= end:
        date_str = current_date.strftime("%Y-%m-%d")

        # 生成时段
        current_time = current_date.replace(hour=start_hour, minute=start_min)
        end_time = current_date.replace(hour=end_hour, minute=end_min)

        while current_time < end_time:
            slot_end = current_time + timedelta(minutes=slot_duration)
            if slot_end > end_time:
                break

            slot = {
                "venue_id": venue_id,
                "date": date_str,
                "start_time": current_time.strftime("%H:%M"),
                "end_time": slot_end.strftime("%H:%M"),
                "price": slot_price,
                "status": "available"
            }

            # 检查是否已存在
            existing = await slots_col.find_one({
                "venue_id": venue_id,
                "date": date_str,
                "start_time": slot["start_time"]
            })

            if not existing:
                await slots_col.insert_one(slot)
                slots_created += 1

            current_time = slot_end

        current_date += timedelta(days=1)

    return {"message": "生成成功", "slots_created": slots_created}


@router.get("/owner/my", response_model=List[Venue])
async def get_my_venues(user: User = Depends(get_current_user)):
    """获取我的场地"""
    venues_col = get_collection("venues")
    cursor = venues_col.find({"owner_id": user.id, "status": {"$ne": "deleted"}})

    venues = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        venues.append(Venue(**doc))

    return venues


# ============ 附加服务接口 ============

@router.post("/{venue_id}/services")
async def create_service(
    venue_id: str,
    name: str,
    price: float,
    stock: int = 0,
    user: User = Depends(get_current_user)
):
    """创建附加服务"""
    user_role_values = [r.value for r in user.roles]
    is_admin = UserRole.ADMIN.value in user_role_values

    venues_col = get_collection("venues")
    services_col = get_collection("services")

    venue = await venues_col.find_one({"_id": ObjectId(venue_id)})
    if not venue:
        raise HTTPException(status_code=404, detail="场地不存在")

    if venue["owner_id"] != user.id and not is_admin:
        raise HTTPException(status_code=403, detail="无权限")

    service = {
        "venue_id": venue_id,
        "name": name,
        "price": price,
        "stock": stock,
        "enabled": True
    }

    result = await services_col.insert_one(service)
    service["id"] = str(result.inserted_id)

    return service


@router.get("/{venue_id}/services")
async def get_venue_services(venue_id: str):
    """获取场地的附加服务"""
    services_col = get_collection("services")
    cursor = services_col.find({"venue_id": venue_id, "enabled": True})

    services = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        services.append(doc)

    return services


@router.put("/{venue_id}/services/{service_id}")
async def update_service(
    venue_id: str,
    service_id: str,
    name: Optional[str] = None,
    price: Optional[float] = None,
    stock: Optional[int] = None,
    enabled: Optional[bool] = None,
    user: User = Depends(get_current_user)
):
    """更新附加服务"""
    user_role_values = [r.value for r in user.roles]
    is_admin = UserRole.ADMIN.value in user_role_values

    venues_col = get_collection("venues")
    services_col = get_collection("services")

    venue = await venues_col.find_one({"_id": ObjectId(venue_id)})
    if not venue:
        raise HTTPException(status_code=404, detail="场地不存在")

    if venue["owner_id"] != user.id and not is_admin:
        raise HTTPException(status_code=403, detail="无权限")

    update_data = {}
    if name is not None:
        update_data["name"] = name
    if price is not None:
        update_data["price"] = price
    if stock is not None:
        update_data["stock"] = stock
    if enabled is not None:
        update_data["enabled"] = enabled

    if update_data:
        await services_col.update_one(
            {"_id": ObjectId(service_id)},
            {"$set": update_data}
        )

    doc = await services_col.find_one({"_id": ObjectId(service_id)})
    doc["id"] = str(doc.pop("_id"))

    return doc