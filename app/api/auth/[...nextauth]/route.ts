import NextAuth from "next-auth";
import { authOptions } from "@/lib/authOptions";

const handler = NextAuth({
  ...authOptions,
  secret: "test-secret-123456789012345678901234567890",
});

export { handler as GET, handler as POST };