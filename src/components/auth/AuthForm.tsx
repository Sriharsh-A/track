"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";

function describeAuthError(error: { message?: string; code?: string; status?: number }) {
  const message = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  if (message.includes("invalid login") || message.includes("invalid_credentials")) return "EMAIL OR PASSWORD IS INCORRECT.";
  if (message.includes("already registered") || message.includes("user_already_exists")) return "AN ACCOUNT ALREADY EXISTS FOR THIS EMAIL.";
  if (message.includes("password") && (message.includes("weak") || message.includes("short"))) return "USE A STRONGER PASSWORD (AT LEAST 8 CHARACTERS).";
  if (message.includes("email") && message.includes("invalid")) return "ENTER A VALID EMAIL ADDRESS.";
  return "AUTHENTICATION COULD NOT BE COMPLETED. CHECK YOUR CONNECTION AND TRY AGAIN.";
}

function FormContent({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const configured = hasSupabaseConfig();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submittedEmail = String(formData.get("email") ?? "").trim();
    const submittedPassword = String(formData.get("password") ?? "");
    const submittedConfirmPassword = String(formData.get("confirmPassword") ?? "");
    setError("");
    setNotice("");
    if (mode === "signup" && submittedPassword !== submittedConfirmPassword) {
      setError("PASSWORDS DO NOT MATCH.");
      return;
    }
    if (!configured) {
      setError("SUPABASE IS NOT CONFIGURED. ADD THE PROJECT URL AND PUBLISHABLE KEY TO .ENV.LOCAL.");
      return;
    }
    setPending(true);
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: submittedEmail,
          password: submittedPassword,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (signUpError) throw signUpError;
        if (data.user && !data.session && data.user.identities?.length === 0) {
          setError("AN ACCOUNT MAY ALREADY EXIST FOR THIS EMAIL. TRY LOGGING IN.");
          return;
        }
        if (data.session) router.replace("/dashboard");
        else setNotice("ACCOUNT CREATED. CHECK YOUR EMAIL TO CONFIRM, THEN LOG IN.");
      } else {
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email: submittedEmail, password: submittedPassword });
        const errorCode = typeof loginError?.code === "string" && /^[a-zA-Z0-9_:-]{1,80}$/.test(loginError.code) ? loginError.code : "none";
        console.info(`[auth-flow] password grant complete; user_present=${loginData.user ? "yes" : "no"}; session_present=${loginData.session ? "yes" : "no"}; error_code=${errorCode}; error_status=${loginError?.status ?? "none"}`);
        if (loginError) throw loginError;
        console.info("[auth-flow] redirect requested; target=/dashboard");
        router.replace("/dashboard");
      }
      router.refresh();
    } catch (cause) {
      setError(describeAuthError(cause as { message?: string; code?: string; status?: number }));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-shell">
      <Link className="brand auth-brand" href="/login" aria-label="TRACK"><span className="brand-mark auth-brand-mark">◇</span><span className="brand-name">TRACK</span></Link>
      <section className="auth-panel">
        <p className="dialog-kicker"><span className="kicker-square" /> PERSONAL TRACKING SYSTEM</p>
        <h1>{mode === "login" ? "LOG IN" : "CREATE ACCOUNT"}</h1>
        <p className="auth-intro">{mode === "login" ? "RESUME YOUR TRACKING SYSTEM." : "SET UP YOUR PERSONAL TRACKING SYSTEM."}</p>
        {searchParams.get("setup") === "1" && <p className="auth-message">ADD YOUR SUPABASE PROJECT URL AND PUBLISHABLE KEY IN .ENV.LOCAL, THEN RESTART TRACK.</p>}
        {searchParams.get("error") && <p className="auth-error">SIGN-IN LINK COULD NOT BE VERIFIED. TRY AGAIN.</p>}
        {!configured && searchParams.get("setup") !== "1" && <p className="auth-message">SUPABASE CONNECTION DETAILS ARE REQUIRED BEFORE ACCOUNT ACCESS IS AVAILABLE.</p>}
        <form className="auth-form" onSubmit={submit}>
          <label className="form-field"><span>EMAIL</span><input autoComplete="email" name="email" required type="email" /></label>
          <label className="form-field"><span>PASSWORD</span><input autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} name="password" required type="password" /></label>
          {mode === "signup" && <label className="form-field"><span>CONFIRM PASSWORD</span><input autoComplete="new-password" minLength={8} name="confirmPassword" required type="password" /></label>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          {notice && <p className="auth-message" role="status">{notice}</p>}
          <button className="create-plan-button auth-submit" disabled={pending || !configured} type="submit">{pending ? "CONNECTING..." : mode === "login" ? "LOG IN" : "CREATE ACCOUNT"} <span aria-hidden="true">↗</span></button>
        </form>
        <p className="auth-switch">{mode === "login" ? <>NEW TO TRACK? <Link href="/signup">CREATE ACCOUNT</Link></> : <>ALREADY REGISTERED? <Link href="/login">LOG IN</Link></>}</p>
      </section>
    </main>
  );
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  return <Suspense fallback={<main className="auth-shell"><p className="plans-loading">LOADING AUTHENTICATION...</p></main>}><FormContent mode={mode} /></Suspense>;
}
