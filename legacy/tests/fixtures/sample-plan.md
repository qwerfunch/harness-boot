# TaskFlow — Team Collaboration Task Management Platform

## Overview

TaskFlow is a web-based task management platform for small-to-medium teams (5-50 members). Teams create projects, manage tasks with workflow states, assign members with role-based permissions, and receive real-time notifications for task events.

## Target Users

- Project managers who need to track team progress
- Developers who need clear task assignments and priorities
- Team leads who need role-based access control per project

## Modules

### Auth Module
Handles user identity, authentication, and authorization across the entire platform.

- Email/password signup with email verification
- JWT-based login with refresh token rotation
- Role-Based Access Control (RBAC): platform-level roles (admin, user) and project-level roles (owner, editor, viewer)
- Password reset via email link

### Project Module
Manages project lifecycle and team membership.

- Project CRUD (create, read, update, archive)
- Member invitation via email with role assignment
- Project settings (visibility, default task priority, notification preferences)
- Project dashboard with task summary statistics

### Task Module
Core task management with workflow state machine.

- Task CRUD with rich description (markdown support)
- Workflow state transitions: Todo → In Progress → Review → Done
- Task assignment to project members with priority levels (P0-P3)
- Due date management with overdue detection
- Task filtering and sorting by status, assignee, priority, due date
- Task comments and activity log

### Notification Module
Delivers real-time and asynchronous notifications for task events.

- WebSocket-based real-time notifications (task assigned, status changed, comment added)
- Email notifications for critical events (task assigned to you, due date approaching, overdue)
- Per-user notification preferences (enable/disable per event type)
- Notification history with read/unread status

## Features

### FEAT-001: Email Signup
**Category**: auth
**Description**: User can sign up with email and password. Email must be unique. Password requires minimum 8 characters with at least one number and one special character. Send verification email after signup.
**Acceptance Criteria**:
- Signup form validates email format and password strength
- Duplicate email returns 409 Conflict
- Verification email sent with unique token (expires in 24h)
- Unverified accounts cannot log in
**Core Functions**: `validateSignupInput`, `createUser`, `hashPassword`, `sendVerificationEmail`

### FEAT-002: JWT Login
**Category**: auth
**Description**: User can log in with email and verified password. Returns JWT access token (15min) and refresh token (7d). Refresh token rotation on each use.
**Acceptance Criteria**:
- Valid credentials return access + refresh tokens
- Invalid credentials return 401 with generic message (no enumeration)
- Unverified email returns 403
- Refresh token rotation invalidates old refresh token
**Core Functions**: `authenticateUser`, `generateTokenPair`, `rotateRefreshToken`, `validateRefreshToken`

### FEAT-003: Role-Based Access Control
**Category**: auth
**Description**: Implement RBAC with platform roles (admin, user) and project-level roles (owner, editor, viewer). Middleware checks permissions before every protected operation.
**Acceptance Criteria**:
- Admin can manage all projects and users
- Project owner can manage project settings and members
- Editor can create/edit tasks but not manage members
- Viewer can only read project content
- Unauthorized access returns 403
**Core Functions**: `checkPermission`, `assignProjectRole`, `getEffectivePermissions`, `rbacMiddleware`

### FEAT-004: Project CRUD
**Category**: project
**Description**: Create, read, update, and archive projects. Archived projects are soft-deleted (not permanently removed). Project creator becomes the owner automatically.
**Acceptance Criteria**:
- Create project with name, description → creator becomes owner
- List projects the user is a member of
- Update project name/description (owner/editor only)
- Archive project (owner only) → tasks become read-only
**Core Functions**: `createProject`, `getProjectsByUser`, `updateProject`, `archiveProject`

### FEAT-005: Member Invitation
**Category**: project
**Description**: Project owner invites users by email with a specified project role. Invitation creates a pending membership that activates when the invited user accepts.
**Acceptance Criteria**:
- Owner can invite by email with role (editor/viewer)
- Invitation email contains accept link
- Accepting adds user to project with specified role
- Re-inviting existing member updates role (owner only)
- Only owner can change member roles
**Core Functions**: `inviteMember`, `acceptInvitation`, `updateMemberRole`, `removeMember`

### FEAT-006: Task CRUD
**Category**: task
**Description**: Create, read, update, and delete tasks within a project. Tasks have title, markdown description, status, priority, assignee, and due date.
**Acceptance Criteria**:
- Create task with title (required), description, priority, due date
- New tasks default to "Todo" status and P2 priority
- List tasks with filtering by status, assignee, priority
- Update any task field (editor+ permission)
- Delete task (editor+ permission, soft delete)
**Core Functions**: `createTask`, `getTasksByProject`, `updateTask`, `deleteTask`, `filterTasks`

### FEAT-007: Task Workflow
**Category**: task
**Description**: Tasks follow a state machine: Todo → In Progress → Review → Done. Transitions are validated — only allowed transitions are permitted. Done tasks cannot be moved back to Todo (audit trail requirement).
**Acceptance Criteria**:
- Allowed transitions: Todo→InProgress, InProgress→Review, Review→Done, Review→InProgress, InProgress→Todo
- Blocked transition: Done→Todo (returns 422)
- Status change records timestamp and actor in activity log
- Changing to "In Progress" auto-assigns current user if unassigned
**Core Functions**: `transitionTaskStatus`, `validateTransition`, `recordActivityLog`
**Business Rules**:
- Done status is terminal for forward flow (audit trail compliance)
- Review→InProgress is allowed for rework

### FEAT-008: Task Assignment
**Category**: task
**Description**: Assign tasks to project members with priority levels (P0-P3). P0 is critical/blocking, P3 is low priority. Assignment triggers a notification to the assignee.
**Acceptance Criteria**:
- Assign task to any project member (editor+ permission)
- Priority levels: P0 (critical), P1 (high), P2 (medium), P3 (low)
- Assigning triggers notification to assignee
- Reassigning triggers notification to both old and new assignee
- Cannot assign to non-members (returns 400)
**Core Functions**: `assignTask`, `updatePriority`, `emitTaskAssignedEvent`

### FEAT-009: Real-time Notifications
**Category**: notification
**Description**: WebSocket-based real-time notification delivery. Users receive instant notifications for events in their projects: task assigned, status changed, comment added, member invited.
**Acceptance Criteria**:
- WebSocket connection authenticated via JWT
- Notifications delivered within 1 second of event
- Client receives notifications only for projects they belong to
- Reconnection handles missed notifications (fetch since last seen)
- Notification has title, body, event type, timestamp, read status
**Core Functions**: `initWebSocket`, `authenticateConnection`, `deliverNotification`, `fetchMissedNotifications`

### FEAT-010: Email Notifications
**Category**: notification
**Description**: Send email notifications for critical task events: task assigned to you, due date within 24 hours, task overdue. Users can configure preferences per event type, except the 24-hour deadline reminder which cannot be disabled (SLA requirement).
**Acceptance Criteria**:
- Email sent when task assigned to user (if preference enabled)
- Email sent 24 hours before due date (always — cannot be disabled)
- Email sent when task becomes overdue (if preference enabled)
- User can enable/disable per event type (except deadline reminder)
- Email contains direct link to the task
**Core Functions**: `sendAssignmentEmail`, `sendDeadlineReminder`, `sendOverdueAlert`, `getNotificationPreferences`, `updateNotificationPreferences`
**Business Rules**:
- 24-hour deadline reminder is mandatory (SLA requirement, cannot be disabled)

## Integration Points

### Task → Notification
- Task assignment event (`task.assigned`) triggers real-time + email notification
- Task status change event (`task.status_changed`) triggers real-time notification
- Task overdue event (`task.overdue`) triggers email notification
- Event format: `{ type, taskId, projectId, actorId, data, timestamp }`

### Project → Task
- Tasks belong to a project (project_id foreign key)
- Task list filtered by project membership
- Member permission checked before task operations (RBAC middleware)
- Archiving a project makes all tasks read-only

### Auth → All Modules
- JWT token validation middleware on all protected routes
- RBAC middleware checks project-level permissions
- User ID extracted from token for audit logging

## Business Rules

1. **Done status is terminal**: Tasks in "Done" cannot transition back to "Todo". This is an audit trail requirement — the full state history must be preserved. Review → In Progress is allowed for rework.

2. **Owner-only member management**: Only the project Owner can invite members, change roles, or remove members. Editors can modify tasks but not team composition.

3. **Mandatory deadline reminder**: The 24-hour deadline email reminder cannot be disabled by users. This is an SLA requirement to ensure no task deadline is missed silently.

4. **Soft delete everywhere**: Projects and tasks are archived/soft-deleted, never permanently removed. This supports data recovery and audit compliance.

5. **No email enumeration**: Login errors return a generic "Invalid credentials" message regardless of whether the email exists. This prevents user enumeration attacks.

## Non-Functional Requirements

- **Performance**: API response time < 200ms P95 for CRUD operations, WebSocket notification delivery < 1s
- **Security**: JWT with refresh rotation, bcrypt password hashing (cost 12+), RBAC on all endpoints
- **Scalability**: Support 50 concurrent users per instance, 100 projects, 10,000 tasks
- **Reliability**: Notification delivery must be at-least-once (retry on failure)

## Success Criteria

1. All 10 features pass acceptance criteria with automated tests
2. RBAC prevents unauthorized access across all endpoints (verified by security tests)
3. Real-time notifications delivered within 1 second of trigger event
4. Email notifications sent for all configured events (verified by integration tests)
5. No data loss on project archive or task deletion (soft delete verified)
