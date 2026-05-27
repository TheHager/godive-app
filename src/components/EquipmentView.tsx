import React, { useState, useEffect } from "react";
import { View, Equipment } from "../types";
import { ArrowLeft, Box, Plus, Settings2, Trash2, Save, Calendar, AlertTriangle, ArrowRight, Check, Star, X, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { cn } from "../lib/utils";
import { filterProfanity } from "../lib/profanity";

export const EquipmentView = ({ setView }: { setView: (v: View) => void }) => {
  const { user } = useAuth();
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [type, setType] = useState("Regulator");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [lastServiceDate, setLastServiceDate] = useState("");
  const [nextServiceDate, setNextServiceDate] = useState("");
  const [useCount, setUseCount] = useState(0);
  const [useLimit, setUseLimit] = useState<number | ''>('');
  const [weight, setWeight] = useState<number | ''>('');
  const [capacity, setCapacity] = useState<number | ''>('');
  const [notes, setNotes] = useState("");

  const equipmentTypes = ["Regulator", "BCD", "Computer", "Wetsuit", "Tank", "Fins", "Mask", "Other"];

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "equipment"),
      where("userId", "==", user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const equip: Equipment[] = [];
      snapshot.forEach((docSnap) => {
        equip.push({ id: docSnap.id, ...docSnap.data() } as Equipment);
      });
      setEquipmentList(equip);
      setIsLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, "equipment"));
    return () => unsubscribe();
  }, [user]);

  const resetForm = () => {
    setName("");
    setType("Regulator");
    setPurchaseDate("");
    setLastServiceDate("");
    setNextServiceDate("");
    setUseCount(0);
    setUseLimit('');
    setWeight('');
    setCapacity('');
    setNotes("");
    setIsAdding(false);
    setEditingId(null);
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;

    const data = {
      userId: user.uid,
      name: filterProfanity(name.trim()),
      type,
      useCount: Number(useCount) || 0,
      timestamp: serverTimestamp(),
      ...(useLimit !== '' ? { useLimit: Number(useLimit) } : {}),
      ...(purchaseDate ? { purchaseDate } : {}),
      ...(lastServiceDate ? { lastServiceDate } : {}),
      ...(nextServiceDate ? { nextServiceDate } : {}),
      ...(weight !== '' ? { weight: Number(weight) } : {}),
      ...(capacity !== '' ? { capacity: Number(capacity) } : {}),
      ...(notes.trim() ? { notes: filterProfanity(notes.trim()) } : {})
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, "equipment", editingId), data);
      } else {
        await addDoc(collection(db, "equipment"), data);
      }
      resetForm();
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, "equipment");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "equipment", id));
      setDeletingId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `equipment/${id}`);
    }
  };

  const resetUses = async (id: string) => {
    try {
      await updateDoc(doc(db, "equipment", id), {
        useCount: 0,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `equipment/${id}`);
    }
  };

  const toggleStandardSetup = async (id: string, currentValue: boolean | undefined) => {
    try {
      await updateDoc(doc(db, "equipment", id), {
        isStandardSetup: !currentValue,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `equipment/${id}`);
    }
  };

  const isServiceOverdue = (nextServiceStr?: string) => {
    if (!nextServiceStr) return false;
    const nextDate = new Date(nextServiceStr);
    return new Date() > nextDate;
  };

  return (
    <div className="min-h-screen bg-background pb-20 pt-16 md:pb-0 md:pt-0">
      <div className="mx-auto max-w-4xl p-6 relative">
        <button 
          onClick={() => setView('profile')}
          className="absolute left-6 top-6 flex items-center justify-center p-3 rounded-2xl premium-glass hover:premium-glass transition-colors z-10"
        >
          <ArrowLeft size={20} className="text-[#0b2240]" />
        </button>

        <div className="mb-10 text-center mt-4">
          <h2 className="text-4xl font-black italic tracking-tighter text-[#0b2240]">Equipment <span className="text-secondary">Log</span></h2>
          <p className="font-bold text-xs uppercase tracking-widest text-[#083344] mt-2">Track & Maintain Gear</p>
        </div>

        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-[#0b2240]">Your Gear</h3>
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 rounded-full bg-secondary py-2 px-4 text-background font-bold text-sm hover:bg-secondary/90 transition-colors"
          >
            <Plus size={16} /> Add 
          </button>
        </div>

        <AnimatePresence>
          {isAdding && (
            <motion.form 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleCreateOrUpdate}
              className="mb-8 overflow-hidden"
            >
              <div className="premium-glass p-6 rounded-2xl border  flex flex-col gap-4">
                <h4 className="font-bold text-lg text-secondary uppercase tracking-widest">{editingId ? 'Edit Gear' : 'Add New Gear'}</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#475569] mb-1">Name / Brand</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Aqualung Titan" className="premium-input w-full rounded-xl bg-background  -white/10 px-4 py-3 text-[#0b2240] focus:-secondary focus: transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#475569] mb-1">Type</label>
                    <select value={type} onChange={e => setType(e.target.value)} className="premium-input w-full rounded-xl bg-background  -white/10 px-4 py-3 text-[#0b2240] focus:-secondary focus: transition-colors appearance-none">
                      {equipmentTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#475569] mb-1">Purchase Date</label>
                    <input type="date" value={purchaseDate} onClick={(e) => "showPicker" in HTMLInputElement.prototype && (e.target as HTMLInputElement).showPicker()} onChange={e => setPurchaseDate(e.target.value)} className="premium-input w-full rounded-xl bg-background  -white/10 px-4 py-3 text-[#0b2240] focus:-secondary focus: transition-colors relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-4 [&::-webkit-calendar-picker-indicator]:w-6 [&::-webkit-calendar-picker-indicator]:h-6" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#475569] mb-1">Last Service</label>
                    <input type="date" value={lastServiceDate} onClick={(e) => "showPicker" in HTMLInputElement.prototype && (e.target as HTMLInputElement).showPicker()} onChange={e => setLastServiceDate(e.target.value)} className="premium-input w-full rounded-xl bg-background  -white/10 px-4 py-3 text-[#0b2240] focus:-secondary focus: transition-colors relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-4 [&::-webkit-calendar-picker-indicator]:w-6 [&::-webkit-calendar-picker-indicator]:h-6" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#475569] mb-1">Next Service</label>
                    <input type="date" value={nextServiceDate} onClick={(e) => "showPicker" in HTMLInputElement.prototype && (e.target as HTMLInputElement).showPicker()} onChange={e => setNextServiceDate(e.target.value)} className="premium-input w-full rounded-xl bg-background  -white/10 px-4 py-3 text-[#0b2240] focus:-secondary focus: transition-colors relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-4 [&::-webkit-calendar-picker-indicator]:w-6 [&::-webkit-calendar-picker-indicator]:h-6" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#475569] mb-1">Use Count</label>
                    <input type="number" min="0" value={useCount} onChange={e => setUseCount(parseInt(e.target.value) || 0)} className="premium-input w-full rounded-xl bg-background  -white/10 px-4 py-3 text-[#0b2240] focus:-secondary focus: transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#475569] mb-1">Use Limit <span className="uppercase text-[8px] font-medium text-[#083344]">Optional</span></label>
                    <input type="number" min="1" value={useLimit} onChange={e => setUseLimit(e.target.value === '' ? '' : parseInt(e.target.value))} placeholder="Max uses before service" className="premium-input w-full rounded-xl bg-background  -white/10 px-4 py-3 text-[#0b2240] focus:-secondary focus: transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#475569] mb-1">Weight (kg) <span className="uppercase text-[8px] font-medium text-[#083344]">Optional</span></label>
                    <input type="number" step="0.1" min="0" value={weight} onChange={e => setWeight(e.target.value === '' ? '' : parseFloat(e.target.value))} className="premium-input w-full rounded-xl bg-background  -white/10 px-4 py-3 text-[#0b2240] focus:-secondary focus: transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#475569] mb-1">Capacity (L) <span className="uppercase text-[8px] font-medium text-[#083344]">Optional</span></label>
                    <input type="number" step="0.5" min="0" value={capacity} onChange={e => setCapacity(e.target.value === '' ? '' : parseFloat(e.target.value))} className="premium-input w-full rounded-xl bg-background  -white/10 px-4 py-3 text-[#0b2240] focus:-secondary focus: transition-colors" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#475569] mb-1">Notes</label>
                  <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Condition, serial number, etc." className="premium-input w-full rounded-xl bg-background  -white/10 px-4 py-3 text-[#0b2240] focus:-secondary focus: transition-colors" />
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <button type="button" onClick={resetForm} className="px-4 py-2 rounded-xl text-[#475569] hover:premium-glass font-bold text-sm transition-colors">Cancel</button>
                  <button type="submit" className="px-6 py-2 rounded-xl bg-secondary text-background font-bold text-sm hover:bg-secondary/90 transition-colors flex items-center gap-2"><Save size={16} /> Save</button>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="text-center py-20 text-[#475569]">Loading equipment...</div>
        ) : equipmentList.length === 0 ? (
          <div className="text-center py-20 border  rounded-3xl premium-glass-low/30 ">
            <Box size={48} className="mx-auto text-[#083344] mb-4" />
            <h4 className="text-xl font-bold text-[#0b2240] mb-2">No Equipment Logged</h4>
            <p className="text-[#475569] text-sm mb-6 max-w-sm mx-auto">Keep track of your dive gear, service dates, and usage.</p>
            <button 
              onClick={() => setIsAdding(true)}
              className="inline-flex items-center gap-2 rounded-full bg-secondary/10 px-6 py-3 text-secondary font-bold hover:bg-secondary/20 transition-colors"
            >
              <Plus size={18} /> Log First Item
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {equipmentList.map(item => (
              <div key={item.id} className="p-6 rounded-2xl premium-glass-low border  flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs font-black uppercase tracking-widest text-tertiary bg-tertiary/10 px-2 py-1 rounded-md">{item.type}</span>
                    {(isServiceOverdue(item.nextServiceDate) || (item.useLimit && item.useCount >= item.useLimit)) && (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-error bg-error/10 px-2 py-1 rounded-md">
                        <AlertTriangle size={12} /> Service Due
                      </span>
                    )}
                  </div>
                  <h4 className="flex items-center gap-2 text-xl font-bold text-[#0b2240] capitalize">
                    {item.name}
                    {item.isStandardSetup && (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-secondary bg-secondary/10 px-2 py-0.5 rounded border border-secondary/20">
                        <Star size={10} className="fill-secondary" /> Standard
                      </span>
                    )}
                  </h4>
                  {(item.notes || item.purchaseDate || item.weight !== undefined || item.capacity !== undefined) && (
                    <p className="text-sm text-[#475569] mt-1 line-clamp-2">
                      {item.purchaseDate && <span className="mr-3 text-[10px] uppercase tracking-widest premium-glass px-2 py-0.5 rounded">Purchased: {item.purchaseDate}</span>}
                      {item.weight !== undefined && <span className="mr-3 text-[10px] uppercase tracking-widest premium-glass px-2 py-0.5 rounded">{item.weight} kg</span>}
                      {item.capacity !== undefined && <span className="mr-3 text-[10px] uppercase tracking-widest premium-glass px-2 py-0.5 rounded">{item.capacity} L</span>}
                      <span className="block mt-1">{item.notes}</span>
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap md:flex-nowrap items-center gap-6 border-t md:border-t-0  pt-4 md:pt-0">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#083344] mb-1">Uses</p>
                      <p className={cn("text-lg font-black", (item.useLimit && item.useCount >= item.useLimit) ? "text-error" : "text-[#0b2240]")}>
                        {item.useCount}{item.useLimit ? ` / ${item.useLimit}` : ""}
                      </p>
                    </div>
                    {item.useCount > 0 && (
                      <button
                        onClick={() => resetUses(item.id)}
                        className="p-1.5 rounded-lg text-[#475569] hover:text-[#083344] hover:premium-glass transition-colors"
                        title="Reset Uses"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </div>
                  
                  {item.nextServiceDate && (
                    <div className="text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#083344] mb-1">Next Service</p>
                      <p className={cn("text-sm font-semibold flex items-center gap-1", isServiceOverdue(item.nextServiceDate) ? "text-error" : "text-[#0b2240]")}>
                        <Calendar size={14} /> {item.nextServiceDate}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 ml-auto">
                    <button 
                      onClick={() => {
                        setEditingId(item.id);
                        setName(item.name);
                        setType(item.type);
                        setPurchaseDate(item.purchaseDate || "");
                        setLastServiceDate(item.lastServiceDate || "");
                        setNextServiceDate(item.nextServiceDate || "");
                        setUseCount(item.useCount);
                        setUseLimit(item.useLimit !== undefined ? item.useLimit : '');
                        setWeight(item.weight !== undefined ? item.weight : '');
                        setCapacity(item.capacity !== undefined ? item.capacity : '');
                        setNotes(item.notes || "");
                        setIsAdding(true);
                      }}
                      className="p-2 rounded-xl text-[#475569] hover:text-[#083344] hover:premium-glass transition-colors"
                      title="Edit"
                    >
                      <Settings2 size={18} />
                    </button>
                    <button
                      onClick={() => toggleStandardSetup(item.id, item.isStandardSetup)}
                      className={cn(
                        "p-2 rounded-xl transition-colors",
                        item.isStandardSetup 
                          ? "text-secondary hover:bg-secondary/10 hover:text-secondary" 
                          : "text-[#475569] hover:text-[#083344] hover:premium-glass"
                      )}
                      title={item.isStandardSetup ? "Remove from Standard Setup" : "Add to Standard Setup"}
                    >
                      <Star size={18} className={item.isStandardSetup ? "fill-secondary" : ""} />
                    </button>
                    {deletingId === item.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setDeletingId(null)}
                          className="p-2 rounded-xl text-[#475569] hover:text-[#083344] hover:premium-glass transition-colors"
                          title="Cancel"
                        >
                          <X size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 rounded-xl bg-error/20 text-error hover:bg-error hover:text-[#083344] transition-colors text-xs font-bold px-3 uppercase tracking-wider"
                        >
                          Confirm
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setDeletingId(item.id)}
                        className="p-2 rounded-xl text-error/70 hover:text-error hover:bg-error/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
