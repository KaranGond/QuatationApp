'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Box,
    Card,
    CardContent,
    Typography,
    TextField,
    Button,
    Alert,
    CircularProgress,
    InputAdornment,
    IconButton,
    Stack
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import LogoutIcon from '@mui/icons-material/Logout';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
    return (
        <Suspense fallback={<Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f7fa' }}><CircularProgress sx={{ color: '#ff9800' }} /></Box>}>
            <LoginForm />
        </Suspense>
    );
}

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirect');
    const { signIn, signOut, user, vendor, role } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        if (!email || !password) {
            setErrorMsg('Please enter both email and password.');
            return;
        }

        setLoading(true);
        const res = await signIn(email, password);
        setLoading(false);

        if (!res.success) {
            setErrorMsg(res.error || 'Invalid email or password.');
        } else {
            if (redirectTo) {
                router.push(redirectTo);
            } else {
                const effectiveRole = (res as any)?.role || role;
                if (effectiveRole === 'super_admin') {
                    router.push('/admin');
                } else {
                    router.push('/vendor/dashboard');
                }
            }
        }
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(145deg, #f0f4f8 0%, #e2e8f0 50%, #f8fafc 100%)',
                p: 2,
            }}
        >
            <Box sx={{ width: '100%', maxWidth: 400 }}>
                {/* Logo & Title */}
                <Box sx={{ textAlign: 'center', mb: 2.5 }}>
                    <Box
                        sx={{
                            width: 48,
                            height: 48,
                            borderRadius: '14px',
                            background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mb: 1.5,
                            boxShadow: '0 4px 14px rgba(255, 152, 0, 0.35)',
                        }}
                    >
                        <WbSunnyIcon sx={{ fontSize: 26, color: '#fff' }} />
                    </Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e293b', letterSpacing: '-0.5px' }}>
                        Solar Vendor Portal
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94a3b8', mt: 0.3, display: 'block' }}>
                        Quotation & Commercial Platform
                    </Typography>
                </Box>

                {/* Login Card */}
                <Card
                    elevation={0}
                    sx={{
                        borderRadius: 3,
                        bgcolor: '#fff',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                    }}
                >
                    <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                        {user ? (
                            <Box sx={{ textAlign: 'center', py: 1 }}>
                                <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                                    Signed in as <strong>{user.email}</strong>
                                </Alert>
                                <Typography variant="body2" sx={{ color: '#475569', mb: 2 }}>
                                    Vendor: <strong>{vendor?.name || 'Karan Solar Shop'}</strong>
                                </Typography>
                                <Stack spacing={1.5} alignItems="center">
                                    <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap">
                                        <Button
                                            component={Link}
                                            href={redirectTo || '/'}
                                            variant="contained"
                                            size="small"
                                            endIcon={<ArrowForwardIcon />}
                                            sx={{
                                                bgcolor: '#ff9800',
                                                '&:hover': { bgcolor: '#f57c00' },
                                                fontWeight: 700,
                                                textTransform: 'none',
                                                borderRadius: 2,
                                            }}
                                        >
                                            Quotation Builder
                                        </Button>
                                        {role === 'super_admin' && (
                                            <Button
                                                component={Link}
                                                href="/admin/vendors"
                                                variant="outlined"
                                                size="small"
                                                sx={{
                                                    color: '#475569',
                                                    borderColor: '#cbd5e1',
                                                    fontWeight: 600,
                                                    textTransform: 'none',
                                                    borderRadius: 2,
                                                }}
                                            >
                                                Manage Vendors
                                            </Button>
                                        )}
                                    </Stack>

                                    <Button
                                        variant="text"
                                        size="small"
                                        color="error"
                                        startIcon={<LogoutIcon sx={{ fontSize: 16 }} />}
                                        onClick={async () => {
                                            await signOut();
                                        }}
                                        sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', mt: 1 }}
                                    >
                                        Sign out / Switch account
                                    </Button>
                                </Stack>
                            </Box>
                        ) : (
                            <form onSubmit={handleLogin}>
                                <Typography variant="subtitle1" sx={{ color: '#1e293b', fontWeight: 700, mb: 0.3 }}>
                                    Sign in to your account
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 2.5 }}>
                                    Enter your credentials to continue
                                </Typography>

                                {errorMsg && (
                                    <Alert severity="error" sx={{ mb: 2, borderRadius: 2, fontSize: '0.8rem' }}>
                                        {errorMsg}
                                    </Alert>
                                )}

                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="vendor@company.com"
                                    required
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <EmailIcon sx={{ color: '#94a3b8', fontSize: 18 }} />
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={{
                                        mb: 1.5,
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: 2,
                                            bgcolor: '#f8fafc',
                                            '& fieldset': { borderColor: '#e2e8f0' },
                                            '&:hover fieldset': { borderColor: '#cbd5e1' },
                                            '&.Mui-focused fieldset': { borderColor: '#ff9800' },
                                        },
                                        '& .MuiInputLabel-root.Mui-focused': { color: '#ff9800' },
                                    }}
                                />

                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <LockIcon sx={{ color: '#94a3b8', fontSize: 18 }} />
                                            </InputAdornment>
                                        ),
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    edge="end"
                                                    size="small"
                                                    sx={{ color: '#94a3b8' }}
                                                >
                                                    {showPassword ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={{
                                        mb: 2.5,
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: 2,
                                            bgcolor: '#f8fafc',
                                            '& fieldset': { borderColor: '#e2e8f0' },
                                            '&:hover fieldset': { borderColor: '#cbd5e1' },
                                            '&.Mui-focused fieldset': { borderColor: '#ff9800' },
                                        },
                                        '& .MuiInputLabel-root.Mui-focused': { color: '#ff9800' },
                                    }}
                                />

                                <Button
                                    fullWidth
                                    type="submit"
                                    variant="contained"
                                    disabled={loading}
                                    sx={{
                                        py: 1,
                                        borderRadius: 2,
                                        bgcolor: '#ff9800',
                                        '&:hover': { bgcolor: '#f57c00' },
                                        fontWeight: 700,
                                        fontSize: '0.875rem',
                                        textTransform: 'none',
                                        boxShadow: '0 2px 8px rgba(255,152,0,0.25)',
                                    }}
                                >
                                    {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Sign In'}
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>

                {/* Footer */}
                <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 2, color: '#94a3b8', fontSize: '0.68rem' }}>
                    Solar Quotation Platform • Multi-Vendor SaaS
                </Typography>
            </Box>
        </Box>
    );
}
