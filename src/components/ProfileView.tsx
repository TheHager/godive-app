import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { auth, db } from "../lib/firebase";
import { signOut, deleteUser, updateProfile, GoogleAuthProvider, reauthenticateWithPopup } from "firebase/auth";
import { doc, updateDoc, getDoc, setDoc, serverTimestamp, deleteDoc, increment, query, collection, limit, getDocs, where } from "firebase/firestore";
import { LogOut, User as UserIcon, Phone, Trophy, HeartPulse, UserPlus, Save, Edit3, X, Trash2, AlertTriangle, CreditCard, Star, Settings, ShieldAlert, Box } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { View, UserPrivateInfo } from "../types";
import { filterProfanity } from "../lib/profanity";
import { ActionMenu } from "./ActionMenu";
import { calculateLevel, getRankInfo } from "../constants/ranks";

interface ProfileViewProps {
  setView?: (v: View) => void;
}

import { computeBadgesWithStats } from '../constants/badges';

export const ProfileView = ({ setView }: ProfileViewProps) => {
  const { profile, user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingPrivate, setIsLoadingPrivate] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(profile?.displayName || "");
  const [editBio, setEditBio] = useState(profile?.bio || "");
  const [editCertificates, setEditCertificates] = useState<string[]>(profile?.certificates || []);
  const [newCertificate, setNewCertificate] = useState("");
  const [totalPoints, setTotalPoints] = useState<number>(profile?.points || 0);

  useEffect(() => {
    let isMounted = true;
    const fetchPoints = async () => {
      if (!profile?.id) return;
      try {
        const xp = profile?.points || 0;
        const rankingPoints = profile?.rankingPoints || 0;
        let likes = 0;

        const postsSnapshot = await getDocs(query(collection(db, "posts"), limit(1000)));
        const postPromises = postsSnapshot.docs.map(async (docSnap) => {
           const pData = docSnap.data();
           if (pData.userId === profile.id) {
             likes += (pData.likesCount || 0);
           }
           try {
             const commentsSnapshot = await getDocs(query(collection(db, "posts", docSnap.id, "comments")));
             commentsSnapshot.forEach(c => {
               const cData = c.data();
               if (cData.userId === profile.id) {
                 likes += (cData.likesCount || 0);
               }
             });
           } catch (e) {
             console.error("Error fetching comments for points calculation", e);
           }
        });
        await Promise.all(postPromises);
        
        if (isMounted) {
          setTotalPoints(xp + rankingPoints + likes);
        }
      } catch (e) {
        console.error("Error calculating total points:", e);
      }
    };
    fetchPoints();
    return () => { isMounted = false; };
  }, [profile?.points, profile?.rankingPoints, profile?.id]);

  const [privateInfo, setPrivateInfo] = useState<UserPrivateInfo>({
    phoneNumber: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactName2: "",
    emergencyContactPhone2: "",
    medicalNotes: "",
  });

  const [formData, setFormData] = useState<UserPrivateInfo>({
    phoneNumber: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactName2: "",
    emergencyContactPhone2: "",
    medicalNotes: "",
  });

  useEffect(() => {
    if (profile?.displayName) {
      setEditDisplayName(profile.displayName);
    }
    if (profile?.bio !== undefined) {
      setEditBio(profile.bio);
    }
    if (profile?.certificates) {
      setEditCertificates(profile.certificates);
    }
  }, [profile?.displayName, profile?.bio, profile?.certificates]);

  useEffect(() => {
    const fetchPrivateInfo = async () => {
      if (!profile?.id) return;
      
      try {
        const privateRef = doc(db, "users", profile.id, "private", "info");
        const docSnap = await getDoc(privateRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as UserPrivateInfo;
          setPrivateInfo(data);
          setFormData(data);
        }
      } catch (err) {
        console.error("Error fetching private info:", err);
      } finally {
        setIsLoadingPrivate(false);
      }
    };

    fetchPrivateInfo();
  }, [profile?.id]);

  const validatePhone = (phone: string) => {
    if (!phone) return true; // Optional fields
    // Strip non-digits and check if we have at least 10
    const digits = phone.replace(/\D/g, "");
    return digits.length >= 10;
  };

  const handleSave = async () => {
    if (!profile?.id) return;

    if (!validatePhone(formData.phoneNumber)) {
      setToast("Please include an area code for your phone number.");
      return;
    }

    if (!validatePhone(formData.emergencyContactPhone)) {
      setToast("Please include an area code for the emergency contact.");
      return;
    }

    if (!validatePhone(formData.emergencyContactPhone2)) {
      setToast("Please include an area code for the second emergency contact.");
      return;
    }

    if (formData.emergencyContactPhone && !formData.emergencyContactName.trim()) {
      setToast("Please provide a name for your emergency contact.");
      return;
    }

    if (formData.emergencyContactPhone2 && !formData.emergencyContactName2?.trim()) {
      setToast("Please provide a name for your second emergency contact.");
      return;
    }

    if (editDisplayName.trim() === "") {
      setToast("Display name cannot be empty.");
      return;
    }

    if (editDisplayName.trim().length > 30) {
      setToast("Display name is too long.");
      return;
    }

    setIsSaving(true);
    try {
      const privateRef = doc(db, "users", profile.id, "private", "info");
      
      const filteredData = {
        phoneNumber: formData.phoneNumber || "",
        emergencyContactName: filterProfanity(formData.emergencyContactName || ""),
        emergencyContactPhone: formData.emergencyContactPhone || "",
        emergencyContactName2: filterProfanity(formData.emergencyContactName2 || ""),
        emergencyContactPhone2: formData.emergencyContactPhone2 || "",
        medicalNotes: filterProfanity(formData.medicalNotes || ""),
      };

      const filteredName = filterProfanity(editDisplayName.trim());
      const filteredPhone = formData.phoneNumber || "";

      const userUpdates: any = {};
      
      if (filteredName !== profile.displayName) {
        userUpdates.displayName = filteredName;
      }

      const filteredBio = filterProfanity(editBio.trim());
      if (filteredBio !== profile.bio) {
        userUpdates.bio = filteredBio;
      }
      
      // We don't filter certificates with profanity filter since they are typed by the user, but we can if we want.
      // E.g., Open Water Diver
      if (JSON.stringify(editCertificates) !== JSON.stringify(profile.certificates || [])) {
        userUpdates.certificates = editCertificates;
      }
      
      if (filteredPhone !== profile.phoneNumber) {
        userUpdates.phoneNumber = filteredPhone;
      }
      
      let grantedBonus = false;
      const isAddingEmergencyContact = filteredData.emergencyContactName?.trim() || filteredData.emergencyContactPhone?.trim();
      
      if (isAddingEmergencyContact && !profile?.hasEmergencyContactBonus) {
        userUpdates.hasEmergencyContactBonus = true;
        userUpdates.points = increment(50);
        grantedBonus = true;
      }

      // Update basic profile info
      if (Object.keys(userUpdates).length > 0) {
        await updateDoc(doc(db, "users", profile.id), userUpdates);
        if (userUpdates.displayName) {
          if (auth.currentUser) {
            await updateProfile(auth.currentUser, { displayName: filteredName });
          }
        }
      }

      // Try to update private info, if fails it might not exist yet
      try {
        await updateDoc(privateRef, {
          ...filteredData,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        // Document likely doesn't exist, use setDoc
        await setDoc(privateRef, {
          ...filteredData,
          updatedAt: serverTimestamp(),
        });
      }
      
      setPrivateInfo(filteredData);
      setToast("Safety information updated!");
      setIsEditing(false);
    } catch (err: any) {
      console.error("Error updating profile:", err);
      if (err.message && err.message.includes("permission")) {
        setToast("Permission error. Check your input format.");
      } else {
        setToast("Failed to update safety info.");
      }
    } finally {
      setIsSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;

    if (!file.type.startsWith('image/')) {
      setToast("Please select an image file.");
      return;
    }

    setIsUploadingPhoto(true);

    try {
      // 1. Read file and resize via Canvas
      const resizedBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
             const canvas = document.createElement("canvas");
             let width = img.width;
             let height = img.height;
             const MAX_DIM = 400; // max width/height

             if (width > height) {
               if (width > MAX_DIM) {
                 height *= MAX_DIM / width;
                 width = MAX_DIM;
               }
             } else {
               if (height > MAX_DIM) {
                 width *= MAX_DIM / height;
                 height = MAX_DIM;
               }
             }
             canvas.width = width;
             canvas.height = height;
             
             const ctx = canvas.getContext("2d");
             ctx?.drawImage(img, 0, 0, width, height);
             resolve(canvas.toDataURL("image/jpeg", 0.8));
          };
          img.onerror = () => reject(new Error("Failed to load image"));
          img.src = event.target?.result as string;
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      // 2. Validate with backend /api/moderate-image
      const response = await fetch("/api/moderate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ imageBase64: resizedBase64 })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to validate image.");
      }

      const moderationResult = await response.json();
      if (!moderationResult.safe) {
        setToast("Image rejected. Please upload an appropriate profile picture.");
        setIsUploadingPhoto(false);
        return;
      }

      // 3. Save to Firestore
      const userRef = doc(db, "users", profile.id);
      await updateDoc(userRef, { photoURL: resizedBase64 });
      setToast("Profile picture updated!");

    } catch (error: any) {
      console.error(error);
      setToast(`Failed: ${error.message || "An error occurred while updating profile picture."}`);
    } finally {
      setIsUploadingPhoto(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDeleteProfile = async () => {
    if (!auth.currentUser) return;
    setIsDeleting(true);
    try {
      const uid = auth.currentUser.uid;
      try {

        // Delete Dives
        try {
          const divesSnapshot = await getDocs(query(collection(db, "dives"), where("userId", "==", uid)));
          const deletePromises: Promise<void>[] = [];
          divesSnapshot.forEach(d => deletePromises.push(deleteDoc(d.ref)));
          await Promise.all(deletePromises);
        } catch (e) { console.warn(e); }

        // Delete Sightings
        try {
          const sightingsSnapshot = await getDocs(query(collection(db, "sightings"), where("userId", "==", uid)));
          const deletePromises: Promise<void>[] = [];
          sightingsSnapshot.forEach(d => deletePromises.push(deleteDoc(d.ref)));
          await Promise.all(deletePromises);
        } catch (e) { console.warn(e); }

        // Delete Posts
        try {
          const postsSnapshot = await getDocs(query(collection(db, "posts"), where("userId", "==", uid)));
          const deletePromises: Promise<void>[] = [];
          postsSnapshot.forEach(d => deletePromises.push(deleteDoc(d.ref)));
          await Promise.all(deletePromises);
        } catch (e) { console.warn(e); }

        // Delete User Data
        try {
          await deleteDoc(doc(db, "users", uid, "private", "info"));
        } catch (e) { console.warn(e); }
        
        try {
          await deleteDoc(doc(db, "users", uid));
        } catch (e) { console.warn(e); }

      } catch (e) {
        console.warn("Failed to delete user documents:", e);
      }
      
      await deleteUser(auth.currentUser);
      // If it reaches here, deletion was successful (component might unmount but just in case)
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    } catch (error: any) {
      console.error("Error deleting profile:", error);
      if (error.code === 'auth/requires-recent-login') {
        const providerId = auth.currentUser.providerData[0]?.providerId;
        if (providerId === 'google.com') {
          try {
            const provider = new GoogleAuthProvider();
            await reauthenticateWithPopup(auth.currentUser, provider);
            // Try deleting again after reauth
            try {
              const uid = auth.currentUser.uid;
              await deleteDoc(doc(db, "users", uid, "private", "info")).catch(() => {});
              await deleteDoc(doc(db, "users", uid)).catch(() => {});
            } catch (e) {
               console.warn(e);
            }

            await deleteUser(auth.currentUser);
            setIsDeleting(false);
            setShowDeleteConfirm(false);
          } catch (reauthError: any) {
            console.error("Re-authentication failed:", reauthError);
            setToast(`Re-authentication failed: ${reauthError.message || "Please log out and log back in."}`);
            setIsDeleting(false);
            setShowDeleteConfirm(false);
            setTimeout(() => setToast(null), 3000);
          }
        } else {
          setToast("For security, please log out and log back in before deleting your account.");
          setIsDeleting(false);
          setShowDeleteConfirm(false);
          setTimeout(() => setToast(null), 3000);
        }
      } else {
        setToast(`Error: ${error.message || "Could not delete profile. Please try again."}`);
        setIsDeleting(false);
        setShowDeleteConfirm(false);
        setTimeout(() => setToast(null), 3000);
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-3 md:p-6 max-w-2xl mx-auto flex flex-col gap-3 md:gap-6 pb-2"
    >
      <div className="flex flex-col items-center justify-center p-3 md:p-8 bg-surface-container-high rounded-3xl border border-white/5 shadow-xl relative overflow-hidden">
        <div className="absolute top-4 right-4 z-10">
          <ActionMenu 
            triggerIcon={<Settings size={24} className="text-on-surface-variant" />}
            buttonClassName="hover:bg-white/10"
            items={[
              { label: isEditing ? "Cancel Edit" : "Edit Profile", icon: isEditing ? <X size={16} /> : <Edit3 size={16} />, onClick: () => setIsEditing(!isEditing) },
              { label: "Delete Profile", icon: <Trash2 size={16} />, onClick: () => setShowDeleteConfirm(true), destructive: true }
            ]}
          />
        </div>
        
        <label className="relative mb-6 flex-shrink-0 cursor-pointer group mt-4">
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={handlePhotoUpload}
            disabled={isUploadingPhoto} 
          />
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="Profile" className="h-32 w-32 rounded-full border-4 border-secondary/20 object-cover shadow-2xl transition-opacity group-hover:opacity-75" />
          ) : (
            <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-secondary/20 bg-surface text-primary shadow-2xl transition-opacity group-hover:opacity-75">
              <UserIcon size={64} />
            </div>
          )}
          
          {/* Overlay loading or edit icon */}
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            {isUploadingPhoto ? (
               <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/30 border-t-white" />
            ) : (
               <Edit3 size={24} className="text-white" />
            )}
          </div>
          {(isUploadingPhoto && !profile?.photoURL) && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-100">
               <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/30 border-t-white" />
            </div>
          )}
        </label>

        {((profile?.pinnedBadgeId && profile?.badgeStats) && (() => {
            const b = computeBadgesWithStats(profile.badgeStats!).find((bx: any) => bx.id === profile.pinnedBadgeId);
            if (b && b.earned) {
              const BIcon = b.icon;
              return (
                <div className="flex items-center justify-center gap-2 mb-2 bg-white/5 pr-4 pl-2 py-1.5 rounded-full border border-white/10">
                  <div className="bg-primary/20 text-primary p-2 rounded-full">
                    <BIcon size={16} />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider text-primary">{b.label}</span>
                </div>
              );
            }
            return null;
        })())}

        {isEditing ? (
          <input
            type="text"
            value={editDisplayName}
            onChange={(e) => setEditDisplayName(e.target.value)}
            className="text-2xl md:text-3xl font-black italic tracking-tighter text-on-surface mb-1 bg-surface-container border border-white/10 rounded-xl px-4 py-2 w-full max-w-xs text-center outline-none focus:border-secondary transition-colors"
            placeholder="Your Name"
          />
        ) : (
          <h2 className="text-2xl md:text-3xl font-black italic tracking-tighter text-on-surface mb-1">{profile?.displayName || "Aquavoyager"}</h2>
        )}
        <p className="text-secondary font-black uppercase tracking-[0.2em] text-[10px] md:text-xs mb-1">
          {getRankInfo(calculateLevel(totalPoints)).title}
        </p>
        <p className="text-on-surface-variant font-medium text-sm mb-6">{profile?.email || "No email provided"}</p>
        
        <div className="flex gap-3 md:gap-4 mb-6 md:mb-8 w-full">
          <div className="flex-1 bg-surface-container p-3 md:p-4 rounded-2xl flex flex-col items-center justify-center border border-white/5">
            <span className="text-xl md:text-2xl font-black text-secondary">{(totalPoints || 0).toLocaleString()}</span>
            <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mt-1">Points</span>
          </div>
          <div className="flex-1 bg-surface-container p-3 md:p-4 rounded-2xl flex flex-col items-center justify-center border border-white/5">
            <span className="text-xl md:text-2xl font-black text-tertiary">LVL {calculateLevel(totalPoints)}</span>
            <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mt-1">Explorer Level</span>
          </div>
        </div>

        <div className="w-full space-y-3 md:space-y-4">
          <div className="p-3 md:p-6 bg-surface/50 rounded-2xl border border-white/5 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <UserIcon className="text-secondary" size={18} />
                <h3 className="font-black italic uppercase tracking-widest text-xs">Biography</h3>
              </div>
              {isEditing ? (
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Tell us about your diving journey..."
                  rows={3}
                  className="w-full bg-surface-container p-3 rounded-xl border border-white/5 outline-none text-sm font-medium resize-none focus:border-secondary transition-colors"
                />
              ) : (
                <p className="text-sm text-on-surface-variant font-medium whitespace-pre-wrap">{profile?.bio || "No biography provided yet."}</p>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Star className="text-tertiary" size={18} />
                <h3 className="font-black italic uppercase tracking-widest text-xs">Certifications</h3>
              </div>
              {isEditing ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newCertificate}
                      onChange={e => setNewCertificate(e.target.value)}
                      placeholder="e.g. PADI Open Water"
                      className="flex-1 bg-surface-container p-3 rounded-xl border border-white/5 outline-none text-sm font-medium focus:border-secondary transition-colors"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newCertificate.trim()) {
                            setEditCertificates([...editCertificates, newCertificate.trim()]);
                            setNewCertificate("");
                          }
                        }
                      }}
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        if (newCertificate.trim()) {
                          setEditCertificates([...editCertificates, newCertificate.trim()]);
                          setNewCertificate("");
                        }
                      }}
                      className="bg-tertiary text-on-tertiary px-4 rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-tertiary/90 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editCertificates.map((cert, i) => (
                      <div key={i} className="flex items-center gap-2 bg-surface py-1.5 pl-3 pr-1.5 rounded-lg border border-white/10">
                        <span className="text-xs font-bold">{cert}</span>
                        <button 
                          onClick={() => setEditCertificates(editCertificates.filter((_, idx) => idx !== i))}
                          className="p-1 rounded-md hover:bg-white/10 text-on-surface-variant hover:text-error transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {profile?.certificates && profile.certificates.length > 0 ? (
                    profile.certificates.map((cert, i) => (
                      <div key={i} className="bg-surface py-1.5 px-3 rounded-lg border border-white/10">
                        <span className="text-xs font-bold text-on-surface">{cert}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-on-surface-variant font-medium">No certifications added yet.</p>
                  )}
                </div>
              )}
            </div>

            {profile?.badgeStats && (() => {
              const earnedBadges = computeBadgesWithStats(profile.badgeStats).filter((b: any) => b.earned && b.id !== profile.pinnedBadgeId);
              if (earnedBadges.length > 0) {
                return (
                  <div className="pt-4 border-t border-white/5 mt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy className="text-secondary" size={16} />
                      <h3 className="font-black italic uppercase tracking-widest text-xs">Other Earned Badges</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {earnedBadges.map((b: any) => {
                        const BIcon = b.icon;
                        return (
                          <div key={b.id} className="flex items-center gap-2 bg-surface-container/50 border border-white/10 rounded-xl px-3 py-2" title={b.label}>
                            <BIcon size={14} className="text-secondary" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{b.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>

          <div className="p-3 md:p-6 bg-surface/50 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <HeartPulse className="text-error" size={18} />
              <h3 className="font-black italic uppercase tracking-widest text-xs">Dive Safety Information</h3>
            </div>

            {!profile?.hasEmergencyContactBonus && (
              <p className="text-xs text-secondary font-medium mb-4 italic">Add your emergency contact information to earn 50 XP and points!</p>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5 block ml-1">Your Phone Number</label>
                {isEditing ? (
                  <div className="flex items-center gap-2 bg-surface-container p-3 rounded-xl border border-white/5">
                    <Phone size={16} className="text-on-surface-variant" />
                    <input 
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                      placeholder="+1 (555) 000-0000"
                      className="bg-transparent border-none outline-none text-sm w-full font-medium"
                    />
                  </div>
                ) : (
                  <div className="text-sm font-bold text-on-surface pl-1">{privateInfo.phoneNumber || "Not set"}</div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5 block ml-1">Emergency Contact Name</label>
                  {isEditing ? (
                    <div className="flex items-center gap-2 bg-surface-container p-3 rounded-xl border border-white/5">
                      <UserPlus size={16} className="text-on-surface-variant" />
                      <input 
                        type="text"
                        value={formData.emergencyContactName}
                        onChange={(e) => setFormData({...formData, emergencyContactName: e.target.value})}
                        placeholder="Name"
                        className="bg-transparent border-none outline-none text-sm w-full font-medium"
                      />
                    </div>
                  ) : (
                    <div className="text-sm font-bold text-on-surface pl-1">{privateInfo.emergencyContactName || "Not set"}</div>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5 block ml-1">Emergency Contact Phone</label>
                  {isEditing ? (
                    <div className="flex items-center gap-2 bg-surface-container p-3 rounded-xl border border-white/5">
                      <Phone size={16} className="text-on-surface-variant" />
                      <input 
                        type="tel"
                        value={formData.emergencyContactPhone}
                        onChange={(e) => setFormData({...formData, emergencyContactPhone: e.target.value})}
                        placeholder="Phone"
                        className="bg-transparent border-none outline-none text-sm w-full font-medium"
                      />
                    </div>
                  ) : (
                    <div className="text-sm font-bold text-on-surface pl-1">{privateInfo.emergencyContactPhone || "Not set"}</div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5 block ml-1">Medical Notes (Allergies, Meds, etc.)</label>
                {isEditing ? (
                  <textarea 
                    value={formData.medicalNotes}
                    onChange={(e) => setFormData({...formData, medicalNotes: e.target.value})}
                    placeholder="E.g. Penicillin allergy, Asthma"
                    rows={3}
                    className="w-full bg-surface-container p-3 rounded-xl border border-white/5 outline-none text-sm font-medium resize-none focus:border-primary/50 transition-colors"
                  />
                ) : (
                  <div className="text-sm font-medium text-on-surface-variant pl-1 italic">
                    {privateInfo.medicalNotes || "No medical notes provided"}
                  </div>
                )}
              </div>

              <div className="mt-2 border-t border-white/5 pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant italic">Secondary Emergency Contact (Optional)</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5 block ml-1">Name</label>
                    {isEditing ? (
                      <div className="flex items-center gap-2 bg-surface-container p-3 rounded-xl border border-white/5">
                        <UserPlus size={16} className="text-on-surface-variant" />
                        <input 
                          type="text"
                          value={formData.emergencyContactName2}
                          onChange={(e) => setFormData({...formData, emergencyContactName2: e.target.value})}
                          placeholder="Name (Optional)"
                          className="bg-transparent border-none outline-none text-sm w-full font-medium"
                        />
                      </div>
                    ) : (
                      <div className="text-sm font-bold text-on-surface pl-1">{privateInfo.emergencyContactName2 || "Not set"}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5 block ml-1">Phone</label>
                    {isEditing ? (
                      <div className="flex items-center gap-2 bg-surface-container p-3 rounded-xl border border-white/5">
                        <Phone size={16} className="text-on-surface-variant" />
                        <input 
                          type="tel"
                          value={formData.emergencyContactPhone2}
                          onChange={(e) => setFormData({...formData, emergencyContactPhone2: e.target.value})}
                          placeholder="Phone (Optional)"
                          className="bg-transparent border-none outline-none text-sm w-full font-medium"
                        />
                      </div>
                    ) : (
                      <div className="text-sm font-bold text-on-surface pl-1">{privateInfo.emergencyContactPhone2 || "Not set"}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {isEditing && (
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary p-4 text-on-primary font-black uppercase tracking-widest transition-all hover:bg-primary/90 disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="h-5 w-5 border-2 border-on-primary/30 border-t-on-primary animate-spin rounded-full" />
                ) : (
                  <>
                    <Save size={20} />
                    Save Information
                  </>
                )}
              </button>
            )}
          </div>

          <div className="flex w-full flex-col gap-3 mt-6">
            {setView && (
              <button 
                onClick={() => setView('equipment')}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-surface-container-high py-4 text-on-surface transition-colors hover:bg-white/10 font-black tracking-widest uppercase border border-white/10"
              >
                <Box size={20} />
                <span className="text-sm">Equipment Log</span>
              </button>
            )}

            {setView && (
              user?.email?.toLowerCase() === "tobias.h.jensen@gmail.com" ? (
                <button 
                  onClick={() => setView("admin")}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl bg-error/10 py-4 text-error transition-colors hover:bg-error/20 font-black tracking-widest uppercase border border-error/20"
                >
                  <ShieldAlert size={20} />
                  <span className="text-sm">Admin Dashboard</span>
                </button>
              ) : (
                <button 
                  onClick={() => setView('pricing')}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-tertiary/20 to-secondary/20 py-4 text-white transition-colors hover:from-tertiary/30 hover:to-secondary/30 font-black tracking-widest uppercase border border-secondary/20 shadow-[0_0_15px_rgba(76,214,251,0.15)] group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-tertiary/0 via-white/10 to-secondary/0 translate-x-[-100%] group-hover:animate-[shimmer_2s_infinite]" />
                  <Star size={20} className="text-secondary fill-secondary/50 group-hover:scale-110 transition-transform" />
                  <span className="bg-gradient-to-r from-tertiary to-secondary bg-clip-text text-transparent group-hover:text-white transition-colors text-sm font-black uppercase tracking-tighter">GO DIVE PRO</span>
                </button>
              )
            )}
            
            <button 
              onClick={() => signOut(auth)}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-surface-container-high/50 py-4 text-on-surface transition-colors hover:bg-white/5 font-black tracking-widest uppercase border border-white/5"
            >
              <LogOut size={20} />
              <span className="text-sm">Log Out</span>
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/90 backdrop-blur-sm"
              onClick={() => !isDeleting && setShowDeleteConfirm(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm rounded-[2rem] bg-surface-container-highest p-6 sm:p-8 shadow-2xl border border-error/20"
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="rounded-full bg-error/20 p-4 text-error">
                  <AlertTriangle size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-on-surface mb-2">Delete Profile?</h3>
                  <p className="text-sm text-on-surface-variant font-medium">This action cannot be undone. All your data, badges, and rankings will be permanently removed.</p>
                </div>
                <div className="flex w-full gap-3 mt-4">
                  <button 
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                    className="flex-1 rounded-xl p-3 font-bold text-on-surface-variant bg-surface-container hover:bg-white/5 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDeleteProfile}
                    disabled={isDeleting}
                    className="flex-1 rounded-xl p-3 font-bold text-on-error bg-error hover:bg-error/90 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    {isDeleting ? (
                      <div className="h-4 w-4 border-2 border-on-error/30 border-t-on-error animate-spin rounded-full" />
                    ) : (
                       "Delete"
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-surface-container-high px-4 md:px-6 py-2 md:py-3 rounded-full border border-secondary/20 text-secondary font-bold shadow-2xl z-50 text-[11px] md:text-sm text-center max-w-[85vw] md:max-w-none"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
