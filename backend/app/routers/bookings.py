from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

from app.models.models import (
    Booking, BookingCreate, BookingStatus, BookingService, User, UserRole
)
from app.routers.auth import get_current_user
from app.database import get_collection

router = APIRouter()


@router.post("", response_model=Booking)
async def create_booking(
    booking: BookingCreate,
    user: User = Depends(get_current_user)
):
    """创建预订"""
    slots_col = get_collection("slots")
    venues_col = get_collection("venues")
    bookings_col = get_collection("bookings")
    
    # 检查时段是否可用
    slot = await slots_col.find_one({
        "_id": ObjectId(booking.slot_id),
        "status": "available"
    })
    
    if not slot:
        raise HTTPException(status_code=400, detail="时段不可用")
    
    # 获取场地信息
    venue = await venues_col.find_one({"_id": ObjectId(booking.venue_id)})
    if not venue:
        raise HTTPException(status_code=404, detail="场地不存在")
    
    # 计算总价
    total_price = slot["price"]
    for svc in booking.services:
        total_price += svc.price * svc.quantity
    
    # 创建预订
    booking_dict = booking.model_dump()
    booking_dict["user_id"] = user.id
    booking_dict["total_price"] = total_price
    
    # 是否需要审核
    if venue.get("require_approval", False):
        booking_dict["status"] = BookingStatus.PENDING
    else:
        booking_dict["status"] = BookingStatus.CONFIRMED
    
    booking_dict["created_at"] = datetime.utcnow()
    
    result = await bookings_col.insert_one(booking_dict)
    
    # 更新时段状态
    await slots_col.update_one(
        {"_id": booking.slot_id},
        {"$set": {
            "status": "booked",
            "booking_id": str(result.inserted_id)
        }}
    )
    
    booking_dict["id"] = str(result.inserted_id)
    return Booking(**booking_dict)


@router.get("", response_model=List[Booking])
async def list_my_bookings(
    status: Optional[BookingStatus] = None,
    user: User = Depends(get_current_user)
):
    """我的预订列表"""
    bookings_col = get_collection("bookings")
    query = {"user_id": user.id}
    
    if status:
        query["status"] = status
    
    cursor = bookings_col.find(query).sort("created_at", -1)
    
    bookings = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        bookings.append(Booking(**doc))
    
    return bookings


@router.get("/{booking_id}", response_model=Booking)
async def get_booking(booking_id: str, user: User = Depends(get_current_user)):
    """预订详情"""
    bookings_col = get_collection("bookings")
    doc = await bookings_col.find_one({"_id": ObjectId(booking_id)})
    
    if not doc:
        raise HTTPException(status_code=404, detail="预订不存在")
    
    if doc["user_id"] != user.id:
        # 检查是否是场主
        venues_col = get_collection("venues")
        slot = await get_collection("slots").find_one({"_id": ObjectId(doc["slot_id"])})
        if slot:
            venue = await venues_col.find_one({"_id": slot["venue_id"]})
            if not venue or venue["owner_id"] != user.id:
                raise HTTPException(status_code=403, detail="无权限")
    
    doc["id"] = str(doc.pop("_id"))
    return Booking(**doc)


@router.put("/{booking_id}/cancel")
async def cancel_booking(
    booking_id: str,
    reason: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """取消预订"""
    bookings_col = get_collection("bookings")
    slots_col = get_collection("slots")
    venues_col = get_collection("venues")
    
    booking = await bookings_col.find_one({"_id": ObjectId(booking_id)})
    
    if not booking:
        raise HTTPException(status_code=404, detail="预订不存在")
    
    if booking["user_id"] != user.id:
        raise HTTPException(status_code=403, detail="无权限")
    
    if booking["status"] not in [BookingStatus.PENDING, BookingStatus.CONFIRMED]:
        raise HTTPException(status_code=400, detail="无法取消")
    
    # 检查取消时限
    slot = await slots_col.find_one({"_id": ObjectId(booking["slot_id"])})
    if slot:
        venue = await venues_col.find_one({"_id": slot["venue_id"]})
        cancel_hours = venue.get("cancel_hours", 2) if venue else 2
        
        # 解析时段时间
        slot_datetime = datetime.strptime(
            f"{slot['date']} {slot['start_time']}",
            "%Y-%m-%d %H:%M"
        )
        
        hours_before = (slot_datetime - datetime.utcnow()).total_seconds() / 3600
        
        if hours_before < cancel_hours:
            raise HTTPException(
                status_code=400,
                detail=f"开场前 {cancel_hours} 小时内无法取消"
            )
    
    # 更新预订状态
    await bookings_col.update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": {
            "status": BookingStatus.CANCELLED,
            "cancel_reason": reason,
            "cancelled_at": datetime.utcnow()
        }}
    )
    
    # 释放时段
    if slot:
        slot_id = slot["_id"]
        if isinstance(slot_id, str):
            slot_id = ObjectId(slot_id)
        await slots_col.update_one(
            {"_id": slot_id},
            {"$set": {
                "status": "available",
                "booking_id": None
            }}
        )
    
    return {"message": "取消成功"}


# ============ 场主接口 ============

@router.get("/owner/pending")
async def list_pending_bookings(user: User = Depends(get_current_user)):
    """待审核预订（场主）"""
    user_role_values = [r.value for r in user.roles]
    if not any(r in user_role_values for r in [UserRole.OWNER.value, UserRole.ADMIN.value]):
        raise HTTPException(status_code=403, detail="需要场主权限")
    
    venues_col = get_collection("venues")
    bookings_col = get_collection("bookings")
    
    # 获取我的场地
    my_venues = []
    async for v in venues_col.find({"owner_id": user.id}):
        my_venues.append(str(v["_id"]))
    
    if not my_venues:
        return []
    
    # 查询待审核预订
    cursor = bookings_col.find({
        "venue_id": {"$in": my_venues},
        "status": BookingStatus.PENDING
    }).sort("created_at", -1)
    
    bookings = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        bookings.append(doc)
    
    return bookings


@router.put("/owner/{booking_id}/approve")
async def approve_booking(booking_id: str, user: User = Depends(get_current_user)):
    """批准预订"""
    user_role_values = [r.value for r in user.roles]
    is_admin = UserRole.ADMIN.value in user_role_values
    
    bookings_col = get_collection("bookings")
    venues_col = get_collection("venues")
    
    booking = await bookings_col.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="预订不存在")
    
    venue = await venues_col.find_one({"_id": booking["venue_id"]})
    if not venue or (venue["owner_id"] != user.id and not is_admin):
        raise HTTPException(status_code=403, detail="无权限")
    
    await bookings_col.update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": {"status": BookingStatus.CONFIRMED}}
    )
    
    return {"message": "已批准"}


@router.put("/owner/{booking_id}/reject")
async def reject_booking(
    booking_id: str,
    reason: str,
    user: User = Depends(get_current_user)
):
    """拒绝预订"""
    user_role_values = [r.value for r in user.roles]
    is_admin = UserRole.ADMIN.value in user_role_values
    
    bookings_col = get_collection("bookings")
    slots_col = get_collection("slots")
    venues_col = get_collection("venues")
    
    booking = await bookings_col.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="预订不存在")
    
    venue = await venues_col.find_one({"_id": booking["venue_id"]})
    if not venue or (venue["owner_id"] != user.id and not is_admin):
        raise HTTPException(status_code=403, detail="无权限")
    
    # 更新预订状态
    await bookings_col.update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": {
            "status": BookingStatus.CANCELLED,
            "cancel_reason": reason,
            "cancelled_at": datetime.utcnow()
        }}
    )
    
    # 释放时段
    await slots_col.update_one(
        {"_id": ObjectId(booking["slot_id"])},
        {"$set": {"status": "available", "booking_id": None}}
    )
    
    return {"message": "已拒绝"}


@router.get("/owner/all")
async def list_owner_bookings(
    venue_id: Optional[str] = None,
    date: Optional[str] = None,
    status: Optional[BookingStatus] = None,
    user: User = Depends(get_current_user)
):
    """场主查看所有预订"""
    user_role_values = [r.value for r in user.roles]
    is_admin = UserRole.ADMIN.value in user_role_values
    
    if not any(r in user_role_values for r in [UserRole.OWNER.value, UserRole.ADMIN.value]):
        raise HTTPException(status_code=403, detail="需要场主权限")
    
    venues_col = get_collection("venues")
    bookings_col = get_collection("bookings")
    
    # 获取我的场地
    my_venues = []
    async for v in venues_col.find({"owner_id": user.id}):
        my_venues.append(str(v["_id"]))
    
    if not my_venues:
        return []
    
    # 构建查询
    query = {"venue_id": {"$in": my_venues}}
    
    if venue_id:
        query["venue_id"] = venue_id
    if status:
        query["status"] = status
    
    cursor = bookings_col.find(query).sort("created_at", -1)
    
    # 日期过滤
    bookings = []
    async for doc in cursor:
        if date:
            slot = await get_collection("slots").find_one({"_id": ObjectId(doc["slot_id"])})
            if not slot or slot.get("date") != date:
                continue
        doc["id"] = str(doc.pop("_id"))
        bookings.append(doc)
    
    return bookings