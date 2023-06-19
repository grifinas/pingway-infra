import { join } from "path";

export enum Service {
  Api = "pings-api",
  PingsProcessor = "pings-processor",
  PingsNotifications = "pings-notifications",
  UsersSynchronization = "users-synchronization",
}

export function getServiceEntryFile(service: Service, fn: string) {
  return join(
    "node_modules",
    "@edgaraskazlauskas",
    "pingway-backend",
    "lib",
    "services",
    service,
    `${fn}.js`
  );
}
