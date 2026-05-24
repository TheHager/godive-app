import React, { useState } from "react";
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signOut
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { auth, googleProvider, db } from "../lib/firebase";
import { motion } from "framer-motion";
import { Compass, Mail, Lock, User as UserIcon, AlertCircle, Ship } from "lucide-react";
import { cn } from "../lib/utils";

export const LoginView = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const userCred = await signInWithPopup(auth, googleProvider);
      const userDocRef = doc(db, "users", userCred.user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, {
          id: userCred.user.uid,
          displayName: userCred.user.displayName || "New Navigator",
          email: userCred.user.email || "",
          photoURL: userCred.user.photoURL || "",
          rank: "Apprentice Diver",
          points: 0,
          rankingPoints: 0,
          divesCount: 0,
          currentLocation: "Global Waters",
          subscriptionTier: "free",
          emailVerified: userCred.user.emailVerified,
        });
      }
    } catch (err) {
      setError("Login with Google failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    
    try {
      if (isLogin) {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        if (!userCred.user.emailVerified) {
          await signOut(auth);
          setError("Your email relies on verification. Please check your inbox and verify your email to login.");
          setLoading(false);
          return;
        }
      } else {
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9!@#$%^&*()_[\]{}<>?\\/\-+=|;:.,"'~`]).{6,}$/;
        if (!passwordRegex.test(password)) {
          setError("Password must be at least 6 characters and include an uppercase letter, a lowercase letter, and a number or special character.");
          setLoading(false);
          return;
        }

        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCred.user, { displayName: name });
        try {
           await setDoc(doc(db, "users", userCred.user.uid), { 
             id: userCred.user.uid,
             displayName: name || "New Navigator",
             email: userCred.user.email || "",
             photoURL: userCred.user.photoURL || "",
             rank: "Apprentice Diver",
             points: 0,
             rankingPoints: 0,
             divesCount: 0,
             currentLocation: "Global Waters",
             subscriptionTier: "free",
             emailVerified: userCred.user.emailVerified,
           });
        } catch(e) {
           console.warn("Could not create user document in firestore immediately", e);
        }
        
        await sendEmailVerification(userCred.user);
        await signOut(auth);
        
        setSuccess("Account created! Please check your email to verify your account before logging in.");
        setIsLogin(true);
        setLoading(false);
        return;
      }
    } catch (err) {
      if (err instanceof FirebaseError) {
        if (err.code === 'auth/invalid-credential') setError("Invalid email or password.");
        else if (err.code === 'auth/email-already-in-use') setError("This email is already in use.");
        else setError("An error occurred. Please try again.");
      } else {
        setError("An error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#4cd6fb20_0%,transparent_100%)] opacity-30" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="z-10 w-full max-w-md overflow-hidden rounded-3xl bg-surface p-10 backdrop-blur-3xl border border-outline shadow-xl"
      >
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/20 text-secondary shadow-[0_0_20px_rgba(76,214,251,0.2)]">
            <Ship size={32} />
          </div>
          <h2 className="mb-2 text-4xl font-black uppercase tracking-tighter text-on-surface">GO<span className="text-secondary">DIVE</span></h2>
          <p className="text-on-surface-variant opacity-70">Explore the depths of the ocean with us.</p>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-error/10 p-4 text-sm text-error border border-error/20">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-primary/10 p-4 text-sm text-primary border border-primary/20">
            <Mail size={18} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {!isLogin && (
            <div className="group relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-secondary transition-colors" size={18} />
              <input
                type="text"
                placeholder="Your Name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-2xl border border-outline-variant bg-transparent py-4 pl-12 pr-4 text-on-surface placeholder:text-outline/50 focus:ring-1 focus:ring-secondary/50 transition-all"
              />
            </div>
          )}
          <div className="group relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-secondary transition-colors" size={18} />
            <input
              type="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-outline-variant bg-transparent py-4 pl-12 pr-4 text-on-surface placeholder:text-outline/50 focus:ring-1 focus:ring-secondary/50 transition-all"
            />
          </div>
          <div className="group relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-secondary transition-colors" size={18} />
            <input
              type="password"
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-outline-variant bg-transparent py-4 pl-12 pr-4 text-on-surface placeholder:text-outline/50 focus:ring-1 focus:ring-secondary/50 transition-all"
            />
          </div>
          {!isLogin && (
            <p className="text-xs text-on-surface-variant opacity-70 px-2 mt-1">
              Password must be at least 6 characters and include an uppercase letter, a lowercase letter, and a number or special character.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-secondary py-4 font-bold text-on-secondary shadow-[0_4px_15px_rgba(76,214,251,0.3)] transition-all hover:bg-secondary-container hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            {loading ? "Processing..." : (isLogin ? "Log In" : "Create Profile")}
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/5"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-surface-container-high px-2 text-on-surface-variant font-bold tracking-widest">Or continue with</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-outline bg-transparent py-4 font-bold text-on-background transition-all hover:bg-surface-container-low"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Google Login
        </button>

        <p className="mt-8 text-center text-sm text-on-surface-variant">
          {isLogin ? "Don't have a profile?" : "Already have a profile?"}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="ml-2 font-bold text-secondary hover:underline"
          >
            {isLogin ? "Sign up now" : "Log in here"}
          </button>
        </p>
      </motion.div>
    </div>
  );
};
