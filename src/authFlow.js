function throwClerkError(result) {
  if (result?.error) {
    throw result.error;
  }
}

async function finalize(resource) {
  const result = await resource.finalize();
  throwClerkError(result);
  return { status: "complete" };
}

export function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

export function normalizePhone(value) {
  const raw = value.trim();
  const digits = raw.replace(/\D/g, "");

  if (raw.startsWith("+") && digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return "";
}

export async function startSignIn({
  signIn,
  method,
  email,
  phone,
  password,
}) {
  if (method === "phone-code") {
    const phoneNumber = normalizePhone(phone);
    if (!phoneNumber) {
      throw new Error("Enter a valid phone number, including country code.");
    }
    const result = await signIn.phoneCode.sendCode({
      phoneNumber,
    });
    throwClerkError(result);
    return { status: "verify", kind: "phone-signin" };
  }

  if (method === "email-password") {
    const result = await signIn.password({
      emailAddress: normalizeEmail(email),
      password,
    });
    throwClerkError(result);

    if (signIn.status !== "complete") {
      throw new Error("Sign-in needs another verification step. Use an email code instead.");
    }

    return finalize(signIn);
  }

  const result = await signIn.emailCode.sendCode({
    emailAddress: normalizeEmail(email),
  });
  throwClerkError(result);
  return { status: "verify", kind: "email-signin" };
}

export async function verifySignInCode({ signIn, kind, code }) {
  const result = kind === "phone-signin"
    ? await signIn.phoneCode.verifyCode({ code })
    : await signIn.emailCode.verifyCode({ code });
  throwClerkError(result);

  if (signIn.status !== "complete") {
    throw new Error("Verification needs another step. Try again or contact support.");
  }

  return finalize(signIn);
}

export async function startEmailSignUp({ signUp, email, password, usePassword }) {
  const emailAddress = normalizeEmail(email);
  const result = usePassword
    ? await signUp.password({ emailAddress, password })
    : await signUp.create({ emailAddress });
  throwClerkError(result);

  if (signUp.status === "complete") {
    return finalize(signUp);
  }

  const verification = await signUp.verifications.sendEmailCode();
  throwClerkError(verification);
  return { status: "verify", kind: "email-signup" };
}

export async function verifyEmailSignUp({ signUp, code }) {
  const result = await signUp.verifications.verifyEmailCode({ code });
  throwClerkError(result);

  if (signUp.status !== "complete") {
    throw new Error("Account setup needs another step. Try again or contact support.");
  }

  return finalize(signUp);
}
