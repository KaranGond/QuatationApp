'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    Box,
    AppBar,
    Toolbar,
    Typography,
    Button,
    Chip,
    Container,
    CircularProgress,
    IconButton,
    Tooltip,
} from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import StorefrontIcon from '@mui/icons-material/Storefront';
import ReceiptIcon from '@mui/icons-material/Receipt';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import SettingsInputComponentIcon from '@mui/icons-material/SettingsInputComponent';
import InventoryIcon from '@mui/icons-material/Inventory';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LogoutIcon from '@mui/icons-material/Logout';
import LaunchIcon from '@mui/icons-material/Launch';
import LockPersonIcon from '@mui/icons-material/LockPerson';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import BuildIcon from '@mui/icons-material/Build';
import LoginIcon from '@mui/icons-material/Login';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { useAuth } from '@/context/AuthContext';
import AuthGuard from '@/components/AuthGuard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthGuard>
            <AdminLayoutInner>{children}</AdminLayoutInner>
        </AuthGuard>
    );
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, role, loading, signOut, vendor } = useAuth();

    // Loading indicator
    if (loading) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#0b192c' }}>
                <CircularProgress sx={{ color: '#ff9800' }} />
            </Box>
        );
    }

    const isDeveloper = user && role === 'super_admin';
    const isVendorsManagementPage = pathname === '/admin/vendors';

    // Only protect the multi-tenant remote management console (/admin/vendors)
    if (isVendorsManagementPage && !isDeveloper) {
        return (
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #0b192c 0%, #1e3e62 100%)',
                    p: 3,
                }}
            >
                <Container maxWidth="sm">
                    <Box
                        sx={{
                            p: 4,
                            borderRadius: 4,
                            bgcolor: 'rgba(17, 24, 39, 0.9)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            textAlign: 'center',
                            color: '#fff',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                        }}
                    >
                        <Box
                            sx={{
                                width: 64,
                                height: 64,
                                borderRadius: '50%',
                                bgcolor: 'rgba(239, 68, 68, 0.15)',
                                border: '2px solid rgba(239, 68, 68, 0.4)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mb: 2,
                            }}
                        >
                            <LockPersonIcon sx={{ fontSize: 36, color: '#ef4444' }} />
                        </Box>

                        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
                            Super Admin Console
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 3 }}>
                            Managing other tenant accounts and live remote control requires platform owner credentials.
                            {user ? ` You are currently signed in as ${user.email} (${role}).` : ' You are currently in offline / guest mode.'}
                        </Typography>

                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Button
                                variant="contained"
                                onClick={() => router.push('/login')}
                                sx={{ bgcolor: '#ff9800', '&:hover': { bgcolor: '#f57c00' }, fontWeight: 700 }}
                            >
                                Sign In as Super Admin
                            </Button>
                            <Button
                                variant="outlined"
                                onClick={() => router.push('/admin')}
                                sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', fontWeight: 700 }}
                            >
                                Back to Admin Dashboard
                            </Button>
                            <Button
                                variant="text"
                                onClick={() => router.push('/')}
                                sx={{ color: '#cbd5e1', fontWeight: 600 }}
                            >
                                Quotation Builder
                            </Button>
                        </Box>
                    </Box>
                </Container>
            </Box>
        );
    }

    // Navigation items available to all users (online, offline, vendor, super admin)
    const navItems = [
        { label: 'Overview', href: '/admin', icon: <DashboardIcon sx={{ fontSize: 18 }} /> },
        { label: 'BOM Components', href: '/admin/components', icon: <SettingsInputComponentIcon sx={{ fontSize: 18 }} /> },
        { label: 'Structure Catalog', href: '/admin/structure-catalog', icon: <Inventory2Icon sx={{ fontSize: 18 }} /> },
        { label: 'Solar Products', href: '/admin/products', icon: <InventoryIcon sx={{ fontSize: 18 }} /> },
        { label: 'Quotations', href: '/admin/quotations', icon: <ReceiptIcon sx={{ fontSize: 18 }} /> },
        { label: 'Shop Settings', href: '/vendor/profile', icon: <ManageAccountsIcon sx={{ fontSize: 18 }} /> },
    ];

    // Add Vendors management tab if developer/super_admin
    if (isDeveloper) {
        navItems.splice(1, 0, { label: 'Vendors & Remote', href: '/admin/vendors', icon: <StorefrontIcon sx={{ fontSize: 18 }} /> });
    }

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#f1f5f9' }}>
            <AppBar position="sticky" sx={{ bgcolor: '#0f172a', borderBottom: '1px solid rgba(255,255,255,0.1)' }} elevation={0}>
                <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', minHeight: 56, px: { xs: 2, md: 3 }, py: 0.5, gap: 1 }}>
                    {/* Brand & Mode */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Link href="/admin" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <AdminPanelSettingsIcon sx={{ color: '#ff9800', fontSize: 24 }} />
                            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
                                Admin Dashboard
                            </Typography>
                        </Link>
                        {isDeveloper ? (
                            <Chip
                                label="Developer Master"
                                size="small"
                                sx={{
                                    bgcolor: 'rgba(255, 152, 0, 0.15)',
                                    color: '#ff9800',
                                    border: '1px solid rgba(255, 152, 0, 0.3)',
                                    fontWeight: 800,
                                    fontSize: '0.7rem',
                                    height: 22,
                                }}
                            />
                        ) : vendor ? (
                            <Chip
                                label={vendor.name || 'Vendor'}
                                size="small"
                                sx={{
                                    bgcolor: 'rgba(34, 197, 94, 0.15)',
                                    color: '#4ade80',
                                    border: '1px solid rgba(34, 197, 94, 0.3)',
                                    fontWeight: 700,
                                    fontSize: '0.7rem',
                                    height: 22,
                                }}
                            />
                        ) : (
                            <Chip
                                icon={<WifiOffIcon sx={{ fontSize: '13px !important', color: '#94a3b8 !important' }} />}
                                label="Offline / Local"
                                size="small"
                                sx={{
                                    bgcolor: 'rgba(148, 163, 184, 0.15)',
                                    color: '#94a3b8',
                                    border: '1px solid rgba(148, 163, 184, 0.3)',
                                    fontWeight: 600,
                                    fontSize: '0.68rem',
                                    height: 22,
                                }}
                            />
                        )}
                    </Box>

                    {/* Nav Links */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                        {navItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                                    <Button
                                        size="small"
                                        startIcon={item.icon}
                                        sx={{
                                            color: isActive ? '#fff' : 'rgba(255,255,255,0.7)',
                                            bgcolor: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                                            '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', color: '#fff' },
                                            textTransform: 'none',
                                            fontWeight: isActive ? 700 : 500,
                                            fontSize: '0.8rem',
                                            px: 1.2,
                                            py: 0.5,
                                            borderRadius: 2,
                                        }}
                                    >
                                        {item.label}
                                    </Button>
                                </Link>
                            );
                        })}
                    </Box>

                    {/* Right side controls */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Link href="/?tab=Service" style={{ textDecoration: 'none' }}>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<BuildIcon sx={{ fontSize: 13 }} />}
                                sx={{
                                    color: '#e2e8f0',
                                    borderColor: 'rgba(255,255,255,0.25)',
                                    '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.05)' },
                                    fontWeight: 600,
                                    textTransform: 'none',
                                    fontSize: '0.78rem',
                                    borderRadius: 2,
                                }}
                            >
                                Service
                            </Button>
                        </Link>

                        <Link href="/" style={{ textDecoration: 'none' }}>
                            <Button
                                variant="contained"
                                size="small"
                                endIcon={<LaunchIcon sx={{ fontSize: 14 }} />}
                                sx={{
                                    bgcolor: '#ff9800',
                                    '&:hover': { bgcolor: '#f57c00' },
                                    fontWeight: 700,
                                    textTransform: 'none',
                                    fontSize: '0.8rem',
                                    borderRadius: 2,
                                }}
                            >
                                Quotation App
                            </Button>
                        </Link>

                        {user ? (
                            <>
                                <Tooltip title={`Signed in as: ${user.email}`}>
                                    <Chip
                                        label={user.email}
                                        size="small"
                                        sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#cbd5e1', fontSize: '0.72rem', maxWidth: 160 }}
                                    />
                                </Tooltip>

                                <IconButton
                                    size="small"
                                    onClick={() => signOut()}
                                    title="Sign Out"
                                    sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#ef4444' } }}
                                >
                                    <LogoutIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                            </>
                        ) : (
                            <Link href="/login" style={{ textDecoration: 'none' }}>
                                <Button
                                    size="small"
                                    startIcon={<LoginIcon sx={{ fontSize: 14 }} />}
                                    sx={{
                                        color: '#cbd5e1',
                                        textTransform: 'none',
                                        fontSize: '0.78rem',
                                        '&:hover': { color: '#fff' }
                                    }}
                                >
                                    Sign In
                                </Button>
                            </Link>
                        )}
                    </Box>
                </Toolbar>
            </AppBar>

            <Box component="main">
                {children}
            </Box>
        </Box>
    );
}
