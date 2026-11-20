import {
  hashStaffPassword,
  makeTemporaryPassword,
} from "../lib/staff-password.ts";

if (!process.stdout.isTTY) {
  process.stderr.write("Run this command in a private interactive terminal.\n");
  process.exit(1);
}

const password = makeTemporaryPassword();
console.log("Temporary password:", password);
console.log("Bootstrap password hash:", await hashStaffPassword(password));
