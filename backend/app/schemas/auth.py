from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    SecretStr,
    field_validator,
    model_validator,
)

from app.core.avatar import MAX_AVATAR_DATA_LENGTH, normalize_avatar
from app.models.enums import UserRole, UserStatus


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr = Field(max_length=320)
    password: SecretStr = Field(min_length=1, max_length=1024)


class RefreshRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    refresh_token: SecretStr = Field(min_length=1, max_length=4096)


class UserIdentityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str | None
    full_name: str | None = None
    role: UserRole | None
    status: UserStatus


class CurrentUserResponse(UserIdentityResponse):
    avatar_base64: str | None = Field(default=None, repr=False)


class TokenResponse(BaseModel):
    access_token: str = Field(repr=False)
    refresh_token: str = Field(repr=False)
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(gt=0)
    refresh_expires_in: int = Field(gt=0)


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr = Field(max_length=320)
    password: SecretStr = Field(min_length=8, max_length=1024)
    full_name: str | None = Field(default=None, min_length=1, max_length=200, pattern=r"\S")


class ProfileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    avatar_base64: str | None = Field(default=None, max_length=MAX_AVATAR_DATA_LENGTH, repr=False)

    @field_validator("avatar_base64")
    @classmethod
    def valid_avatar(cls, value):
        return normalize_avatar(value)

    @model_validator(mode="after")
    def changed_fields(self):
        if not self.model_fields_set:
            raise ValueError("Cần chọn thông tin muốn cập nhật")
        if "full_name" in self.model_fields_set and self.full_name is None:
            raise ValueError("Họ và tên không được để trống")
        return self


class ChangePasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    old_password: SecretStr = Field(min_length=1, max_length=1024)
    new_password: SecretStr = Field(min_length=8, max_length=1024)


class ChangeEmailRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr = Field(max_length=320)
    password: SecretStr = Field(min_length=1, max_length=1024)


class AuthSessionResponse(BaseModel):
    id: UUID
    created_at: datetime
    expires_at: datetime
    is_current: bool
