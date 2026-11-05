import type { AppNotification } from "../types";

export function countUnreadNotifications(notifications: Pick<AppNotification, "read_at">[]) {
  return notifications.filter((notification) => notification.read_at === null).length;
}
