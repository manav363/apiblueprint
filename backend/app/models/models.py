from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..core.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    version = Column(String(20), default="v1.0.0")
    description = Column(Text, default="")
    color = Column(String(20), default="#00d4aa")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    endpoints = relationship("Endpoint", back_populates="project", cascade="all, delete-orphan")
    schemas = relationship("Schema", back_populates="project", cascade="all, delete-orphan")


class Endpoint(Base):
    __tablename__ = "endpoints"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    method = Column(String(10), nullable=False)  # GET POST PUT DELETE PATCH
    path = Column(String(200), nullable=False)
    group_name = Column(String(100), default="Default")
    summary = Column(String(200), default="")
    operation_id = Column(String(100), default="")
    tag = Column(String(100), default="")
    description = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="endpoints")
    parameters = relationship("Parameter", back_populates="endpoint", cascade="all, delete-orphan")
    responses = relationship("Response", back_populates="endpoint", cascade="all, delete-orphan")


class Parameter(Base):
    __tablename__ = "parameters"

    id = Column(Integer, primary_key=True, index=True)
    endpoint_id = Column(Integer, ForeignKey("endpoints.id"), nullable=False)
    name = Column(String(100), nullable=False)
    location = Column(String(20), nullable=False)  # path query header
    type = Column(String(50), default="string")
    required = Column(Boolean, default=False)
    description = Column(String(300), default="")

    endpoint = relationship("Endpoint", back_populates="parameters")


class Response(Base):
    __tablename__ = "responses"

    id = Column(Integer, primary_key=True, index=True)
    endpoint_id = Column(Integer, ForeignKey("endpoints.id"), nullable=False)
    status_code = Column(String(10), nullable=False)
    description = Column(String(300), default="")
    example = Column(Text, default="{}")

    endpoint = relationship("Endpoint", back_populates="responses")


class Schema(Base):
    __tablename__ = "schemas"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="schemas")
    fields = relationship("SchemaField", back_populates="schema", cascade="all, delete-orphan")


class SchemaField(Base):
    __tablename__ = "schema_fields"

    id = Column(Integer, primary_key=True, index=True)
    schema_id = Column(Integer, ForeignKey("schemas.id"), nullable=False)
    parent_id = Column(Integer, ForeignKey("schema_fields.id"), nullable=True)
    name = Column(String(100), nullable=False)
    type = Column(String(50), default="string")
    required = Column(Boolean, default=False)
    description = Column(String(300), default="")

    schema = relationship("Schema", back_populates="fields")
    children = relationship("SchemaField", backref="parent", remote_side=[id])
