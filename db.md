## Table `items`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `content` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `tag` | `text` |  Nullable |
| `type` | `text` |  Nullable |
| `source_url` | `text` |  Nullable |
| `user_id` | `uuid` |  Nullable |
| `status` | `text` |  Nullable |
| `embedding` | `vector` |  Nullable |

## Table `users`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `telegram_chat_id` | `text` |  Nullable Unique |
| `personality_profile` | `jsonb` |  Nullable |
| `onboarding_done` | `bool` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |

## Table `reminders`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Nullable |
| `item_id` | `uuid` |  Nullable |
| `remind_at` | `timestamptz` |  Nullable |
| `sent` | `bool` |  Nullable |
| `message` | `text` |  Nullable |

