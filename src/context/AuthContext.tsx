'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Vendor } from '@/types';

interface AuthContextType {
    user: any | null;
    vendor: Vendor | null;
    role: 'super_admin' | 'vendor' | 'salesperson' | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signOut: () => Promise<void>;
    refreshVendor: () => Promise<void>;
    switchVendor: (vendor: Vendor) => void;
    allVendors: Vendor[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_FALLBACK_VENDOR: Vendor = {
    id: "a0000000-0000-0000-0000-000000000001",
    slug: "karan-solar",
    name: "Karan Solar Shop",
    tagline: "CLEAN ENERGY | BRIGHTER TOMORROW",
    gstin: null,
    head_office: "Varanasi, Uttar Pradesh, India",
    registered_office: "Varanasi, Uttar Pradesh, India",
    phone: "+91 9005770466",
    alternate_phone: "9044555572",
    email: "karangond221998@gmail.com",
    bank_name: "HDFC Bank",
    bank_branch: "Shivpur, Varanasi",
    account_name: "KARAN SOLAR SHOP",
    account_number: "50200123854806",
    ifsc: "HDFC0004807",
    upi_id: "karan.solar@hdfcbank",
    logo_url: "/logo.png",
    signature_url: "/signature.png",
    stamp_url: null,
    authorized_signatory: "Karan Gond",
    default_margin: 0,
    status: "active",
    node_id: "NODE-VNS-001",
    quote_prefix: "KSS",
    plan_tier: "pro",
    is_demo: true,
    components_settings: {},
    created_at: "2026-10-22T11:05:49.814575+00:00",
    updated_at: "2026-10-22T11:05:49.814575+00:00",
};

const syncAuthCookie = (token: string | null) => {
    if (typeof document === 'undefined') return;
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const secureFlag = isHttps ? '; Secure' : '';
    if (token) {
        document.cookie = `sb-access-token=${token}; path=/; max-age=604800; SameSite=Lax${secureFlag}`;
    } else {
        document.cookie = `sb-access-token=; path=/; max-age=0; SameSite=Lax${secureFlag}`;
    }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<any | null>(null);
    const [vendor, setVendor] = useState<Vendor | null>(DEFAULT_FALLBACK_VENDOR);
    const [role, setRole] = useState<'super_admin' | 'vendor' | 'salesperson' | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [allVendors, setAllVendors] = useState<Vendor[]>([DEFAULT_FALLBACK_VENDOR]);

    const vendorRef = useRef<Vendor | null>(DEFAULT_FALLBACK_VENDOR);
    vendorRef.current = vendor;

    const isFetchingRef = useRef<boolean>(false);

    // Fetch vendor details for authenticated user or offline defaults
    const loadUserData = useCallback(async (authUser: any) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        try {
            if (!authUser) {
                setUser(null);
                setRole(null);
                try {
                    const res = await fetch('/api/vendors?active=true');
                    if (res.ok) {
                        const json = await res.json();
                        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
                            setAllVendors(json.data);
                            if (!vendorRef.current || vendorRef.current.id === DEFAULT_FALLBACK_VENDOR.id) {
                                setVendor(json.data[0]);
                            }
                        }
                    }
                } catch {
                    // Offline fallback already in place
                }
                return;
            }

            setUser(authUser);

            // 1. Fetch vendor_users relation
            let userRole: 'super_admin' | 'vendor' | 'salesperson' = 'vendor';
            let assignedVendor: Vendor | null = null;

            try {
                const { data: vUserData, error: vUserErr } = await supabase
                    .from('vendor_users')
                    .select('*, vendors(*)')
                    .eq('id', authUser.id)
                    .maybeSingle();

                if (!vUserErr && vUserData) {
                    userRole = vUserData.role as any;
                    if (vUserData.vendors) {
                        assignedVendor = vUserData.vendors;
                    }
                } else {
                    const metaVendorId = authUser.user_metadata?.vendor_id;
                    userRole = (authUser.user_metadata?.role as any) || 'vendor';
                    if (metaVendorId) {
                        const { data: vData } = await supabase
                            .from('vendors')
                            .select('*')
                            .eq('id', metaVendorId)
                            .maybeSingle();
                        if (vData) assignedVendor = vData;
                    }
                }
            } catch {
                // Ignore Supabase connection timeouts or offline errors
            }

            setRole(userRole);
            if (assignedVendor) {
                setVendor(assignedVendor);
            }

            // 2. Load all vendors list
            try {
                const res = await fetch('/api/vendors');
                if (res.ok) {
                    const json = await res.json();
                    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
                        setAllVendors(json.data);
                        if (!assignedVendor && (!vendorRef.current || vendorRef.current.id === DEFAULT_FALLBACK_VENDOR.id)) {
                            setVendor(json.data[0]);
                        }
                    }
                }
            } catch {
                // Ignore offline vendor load failure
            }
            return userRole;
        } catch {
            console.warn('Notice: running with default vendor settings');
            return null;
        } finally {
            isFetchingRef.current = false;
            setLoading(false);
        }
    }, []);

    const loadUserDataRef = useRef(loadUserData);
    loadUserDataRef.current = loadUserData;

    useEffect(() => {
        // Run once on mount
        supabase.auth.getSession().then(({ data: { session } }) => {
            syncAuthCookie(session?.access_token || null);
            loadUserDataRef.current(session?.user || null);
        });

        // Listen for auth changes (single subscription)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            syncAuthCookie(session?.access_token || null);
            loadUserDataRef.current(session?.user || null);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const signIn = async (email: string, password: string) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password,
            });

            if (error) {
                return { success: false, error: error.message };
            }

            if (data.session?.access_token) {
                syncAuthCookie(data.session.access_token);
            }

            let resolvedRole = null;
            if (data.user) {
                resolvedRole = await loadUserData(data.user);
            }
            return { success: true, role: resolvedRole };
        } catch (err: any) {
            return { success: false, error: err.message || 'Login failed' };
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        syncAuthCookie(null);
        setUser(null);
        setRole(null);
        if (allVendors.length > 0) {
            setVendor(allVendors[0]);
        }
    };

    const refreshVendor = async () => {
        if (user) {
            await loadUserData(user);
        }
    };

    const switchVendor = (targetVendor: Vendor) => {
        if (role === 'super_admin') {
            setVendor(targetVendor);
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                vendor,
                role,
                loading,
                signIn,
                signOut,
                refreshVendor,
                switchVendor,
                allVendors,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
