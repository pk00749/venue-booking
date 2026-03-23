from datetime import datetime
from typing import Optional, List
from enum import Enum
from pydantic import BaseModel, Field
from bson import ObjectId


class PyObjectId(str):
    """ObjectId for Pydantic v2"""
    @classmethod
    def __get_pydantic_core_schema__(cls, source_type, handler):
        from pydantic_core import core_schema
        return core_schema.with_info_plain_validator_function(
            cls.validate
        )

    @classmethod
    def validate(cls, v, info=None):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return str(v)


class UserRole(str, Enum):
    USER = "user"
    OWNER = "owner"
    ADMIN = "admin"


class VenueType(str, Enum):
    BADMINTON = "badminton"
    BASKETBALL = "basketball"
    FOOTBALL = "football"
    TENNIS = "tennis"
    TABLE_TENNIS = "table_tennis"
    OTHER = "other"


class BookingStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class SlotStatus(str, Enum):
    AVAILABLE = "available"
    BOOKED = "booked"
    BLOCKED = "blocked"


# ============ User ============
class UserBase(BaseModel):
    nickname: Optional[str] = None
    avatar: Optional[str] = None
    phone: Optional[str] = None


class UserCreate(UserBase):
    openid: str


class User(UserBase):
    id: str = Field(default_factory=lambda: str(ObjectId()), alias="_id")
    openid: str
    roles: List[UserRole] = [UserRole.USER]  # 支持多角色
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


class UserInDB(User):
    pass


class OwnerApplicationStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class OwnerApplicationBase(BaseModel):
    pass


class OwnerApplication(OwnerApplicationBase):
    id: str = Field(default_factory=lambda: str(ObjectId()), alias="_id")
    user_id: str
    status: OwnerApplicationStatus = OwnerApplicationStatus.PENDING
    reason: Optional[str] = None
    admin_note: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None

    class Config:
        populate_by_name = True


class RoleUpdate(BaseModel):
    role: UserRole
    action: str = "add"  # "add" or "remove"


# ============ Venue ============
class OpenTime(BaseModel):
    start: str = "08:00"  # HH:MM
    end: str = "22:00"


class VenueBase(BaseModel):
    name: str
    type: VenueType
    address: str
    description: Optional[str] = None
    images: List[str] = []


class VenueCreate(VenueBase):
    open_time: OpenTime = OpenTime()
    slot_duration: int = 60  # minutes
    slot_price: float = 50.0  # default price per slot
    require_approval: bool = False
    cancel_hours: int = 2  # hours before start


class Venue(VenueBase):
    id: str = Field(default_factory=lambda: str(ObjectId()), alias="_id")
    owner_id: str
    open_time: OpenTime
    slot_duration: int = 60
    slot_price: float = 50.0
    require_approval: bool = False
    cancel_hours: int = 2
    status: str = "active"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


# ============ Service (附加服务) ============
class ServiceBase(BaseModel):
    name: str
    price: float
    stock: int = 0


class ServiceCreate(ServiceBase):
    venue_id: str


class Service(ServiceBase):
    id: str = Field(default_factory=lambda: str(ObjectId()), alias="_id")
    venue_id: str
    enabled: bool = True

    class Config:
        populate_by_name = True


# ============ Slot (时段) ============
class SlotBase(BaseModel):
    venue_id: str
    date: str  # YYYY-MM-DD
    start_time: str  # HH:MM
    end_time: str  # HH:MM


class SlotCreate(SlotBase):
    price: float


class Slot(SlotBase):
    id: str = Field(default_factory=lambda: str(ObjectId()), alias="_id")
    price: float
    status: SlotStatus = SlotStatus.AVAILABLE
    booking_id: Optional[str] = None

    class Config:
        populate_by_name = True


# ============ Booking ============
class BookingService(BaseModel):
    service_id: str
    name: str
    price: float
    quantity: int = 1


class BookingBase(BaseModel):
    venue_id: str
    slot_id: str
    services: List[BookingService] = []
    contact_name: str
    contact_phone: str


class BookingCreate(BookingBase):
    pass


class Booking(BookingBase):
    id: str = Field(default_factory=lambda: str(ObjectId()), alias="_id")
    user_id: str
    total_price: float
    status: BookingStatus = BookingStatus.PENDING
    cancel_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    cancelled_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


# ============ WeChat Auth ============
class WeChatLoginRequest(BaseModel):
    code: str


class WeChatLoginResponse(BaseModel):
    token: str
    user: User
    is_new_user: bool


# ============ Token ============
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[str] = None