"use client";

import { Button, ButtonVariants } from "@/components/button";
import { Card } from "@/components/card";
import { SignInWithApple } from "@/components/idps/sign-in-with-apple";
import { SignInWithGoogle } from "@/components/idps/sign-in-with-google";
import { TextInput } from "@/components/input";
import { setTheme as setColors } from "@/helpers/colors";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

// MAETRY: interactive visual preview using real components, with no auth requests.
export default function PreviewPage() {
  const [loginname, setLoginname] = useState("");
  const { setTheme } = useTheme();
  useEffect(() => setColors(document), []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-8 text-black dark:bg-black dark:text-white">
      <div className="mb-6 flex gap-4" aria-label="Preview theme">
        <button onClick={() => setTheme("light")}>Light</button>
        <button onClick={() => setTheme("dark")}>Dark</button>
        <button onClick={() => setTheme("system")}>System</button>
      </div>
      <div className="w-full max-w-[408px]">
        <Card>
          <h1 className="mt-8">Welcome back!</h1>
          <p className="mt-5 mb-6 text-center">Enter your login details.</p>
          <TextInput label="Loginname" value={loginname} onChange={(event) => setLoginname(event.target.value)} />
          <button className="mt-1 text-sm">Register new user</button>
          <div className="mt-5 flex justify-between">
            <Button variant={ButtonVariants.Secondary} onClick={() => setLoginname("")}>
              Back
            </Button>
            <Button disabled={!loginname.trim()}>Continue</Button>
          </div>
          <p className="mt-6 mb-2 text-center text-sm">or sign in with</p>
          <div className="flex flex-col gap-2 pb-8">
            <SignInWithGoogle name="Google" />
            <SignInWithApple name="Apple" />
          </div>
        </Card>
      </div>
      <p className="mt-6 text-sm">UI preview — buttons do not sign in.</p>
    </main>
  );
}
