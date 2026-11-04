'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '@/context/AuthContext';

interface AuthGuardProps {
    children: React.ReactNode;
    requiredRole?: 'super_admin' | 'vendor' | 'salesperson';
}

/**
 * Client-side auth guard component.
 * Wraps pages that require authentication.
 * Redirects to /login if not authenticated.
 * Optionally checks for a specific role.
 */
export default function AuthGuard({ children, requiredRole }: AuthGuardProps) {
    const { user, role, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            const currentPath = window.location.pathname + window.location.search;
            router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
        }
    }, [user, loading, router]);

    // Show loading spinner while auth state is resolving
    if (loading) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#f8fafc', gap: 2 }}>
                <CircularProgress sx={{ color: '#ff9800' }} size={36} />
                <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                    Checking authentication...
                </Typography>
            </Box>
        );
    }

    // Not authenticated — will redirect via useEffect
    if (!user) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f8fafc' }}>
                <CircularProgress sx={{ color: '#ff9800' }} size={36} />
            </Box>
        );
    }

    // Role check (if required)
    if (requiredRole && role !== requiredRole) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#f8fafc', gap: 2, p: 3 }}>
                <Typography variant="h6" sx={{ color: '#1e293b', fontWeight: 700 }}>
                    Access Denied
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', textAlign: 'center' }}>
                    You need <strong>{requiredRole}</strong> role to access this page.
                    You are currently signed in as <strong>{role || 'unknown'}</strong>.
                </Typography>
            </Box>
        );
    }

    return <>{children}</>;
}

