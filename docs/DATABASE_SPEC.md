# Database & ERD Specification

## 1. Core Entities
- **UserProfile**: `uid`, `email`, `role`, `displayName`.
- **Product**: `name`, `category`, `price`, `stockLevel`, `minStock`.
- **Order**: `type` (LOUNGE/STORE), `status`, `total`, `items[]`, `paymentMethod`.
- **CarwashJob**: `plateNumber`, `service`, `status`, `attendantId`, `timestamp`.
- **PettyCashRequest**: `amount`, `reason`, `status`, `requesterId`, `timestamp`.
- **AuditLog**: `action`, `userId`, `details`, `timestamp`, `severity`.

## 2. Relationships
- **Orders -> AuditLog**: Every order creation/void generates a log.
- **Inventory -> Orders**: Order completion triggers stock reduction.
- **User -> PettyCash**: Supervisor role required for approval transition.

## 3. Indexing Strategy
- Chronological indexing for `AuditLog` and `Orders` (timestamp).
- Search indexing for `inventory` (name, category).
- Filter indexing for `CarwashJob` (status).
