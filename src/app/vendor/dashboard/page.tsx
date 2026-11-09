'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Container,
    Box,
    Typography,
    Card,
    CardContent,
    Button,
    Grid,
    Chip,
    CircularProgress,
    Stack
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import StorefrontIcon from '@mui/icons-material/Storefront';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import LogoutIcon from '@mui/icons-material/Logout';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { useAuth } from '@/context/AuthContext';
import AuthGuard from '@/components/AuthGuard';
import { apiFetch } from '@/lib/apiFetch';
import { buildQuoteWhatsAppMessage, openWhatsAppDirect } from '@/lib/whatsappShare';

export default function VendorDashboardPage() {
    return (
        <AuthGuard>
            <VendorDashboardContent />
        </AuthGuard>
    );
}

function VendorDashboardContent() {
    const router = useRouter();
    const { user, vendor, signOut, loading: authLoading } = useAuth();

    const [stats, setStats] = useState({
        totalQuotes: 0,
        draftQuotes: 0,
        sentQuotes: 0,
    });
    const [recentQuotes, setRecentQuotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchVendorData = async () => {
            if (!vendor?.id) return;
            setLoading(true);
            try {
                const res = await apiFetch(`/api/quotations?vendor_id=${vendor.id}&limit=10`);
                const json = await res.json();
                if (json.success) {
                    const quotes = json.data || [];
                    setRecentQuotes(quotes.slice(0, 5));
                    setStats({
                        totalQuotes: quotes.length,
                        draftQuotes: quotes.filter((q: any) => q.status === 'draft').length,
                        sentQuotes: quotes.filter((q: any) => q.status === 'sent' || q.status === 'WhatsApp Sent').length,
                    });
                }
            } catch (err) {
                console.error('Failed to load vendor quotes:', err);
            } finally {
                setLoading(false);
            }
        };

        if (vendor?.id) {
            fetchVendorData();
        }
    }, [user, vendor, authLoading, router]);

    const handleShareWhatsApp = (q: any) => {
        if (!q.customer_phone) {
            alert(`No phone number recorded for customer "${q.customer_name}".`);
            return;
        }

        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const brandedPdfUrl = (q.quote_number || q.id)
            ? `${origin}/api/quote/view/${encodeURIComponent(q.quote_number || q.id)}`
            : (q.pdf_url || null);

        const message = buildQuoteWhatsAppMessage({
            customerName: q.customer_name,
            customerPhone: q.customer_phone,
            quoteNumber: q.quote_number || 'Quote',
            quoteDate: new Date(q.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            systemCapacityKw: q.capacity_kw,
            systemType: q.system_type_name || 'Solar Power Plant',
            totalAmount: q.total_amount || 0,
            pdfUrl: brandedPdfUrl || q.pdf_url || null,
            vendorName: q.vendor_snapshot?.name || vendor?.name || 'Solar Quotation',
            vendorSignatory: q.vendor_snapshot?.authorized_signatory || vendor?.authorized_signatory || 'Authorized Signatory',
            vendorPhone: q.vendor_snapshot?.phone || vendor?.phone || '',
        });

        openWhatsAppDirect(q.customer_phone, message);
    };

    if (authLoading || (!user && loading)) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f8fafc' }}>
                <CircularProgress sx={{ color: '#ff9800' }} />
            </Box>
        );
    }

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#f4f6f8', py: 4 }}>
            <Container maxWidth="lg">
                {/* Header Bar */}
                <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box
                            sx={{
                                width: 56,
                                height: 56,
                                borderRadius: 3,
                                bgcolor: '#ff9800',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                boxShadow: '0 8px 16px rgba(255,152,0,0.3)',
                            }}
                        >
                            <StorefrontIcon sx={{ fontSize: 32 }} />
                        </Box>
                        <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="h4" sx={{ fontWeight: 800, color: '#1e293b' }}>
                                    {vendor?.name || 'Vendor Workspace'}
                                </Typography>
                                <Chip label="Vendor Portal" size="small" sx={{ bgcolor: '#ff9800', color: '#fff', fontWeight: 700 }} />
                            </Box>
                            <Typography variant="body2" sx={{ color: '#64748b' }}>
                                Signatory: <strong>{vendor?.authorized_signatory || 'Owner'}</strong> &bull; Logged in as: {user?.email}
                            </Typography>
                        </Box>
                    </Box>

                    <Stack direction="row" spacing={1.5}>
                        <Button
                            variant="outlined"
                            onClick={() => router.push('/vendor/profile')}
                            startIcon={<AccountBalanceIcon />}
                            sx={{ borderColor: '#cbd5e1', color: '#475569', fontWeight: 600 }}
                        >
                            Shop Profile & Bank
                        </Button>
                        <Button
                            variant="outlined"
                            color="error"
                            onClick={() => signOut()}
                            startIcon={<LogoutIcon />}
                            sx={{ fontWeight: 600 }}
                        >
                            Sign Out
                        </Button>
                    </Stack>
                </Box>

                {/* Quick Action Banner */}
                <Card sx={{ mb: 4, borderRadius: 3, background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)', color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                    <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                        <Grid container spacing={3} alignItems="center">
                            <Grid size={{ xs: 12, md: 8 }}>
                                <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
                                    Create a New Customer Quotation
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2, maxWidth: 600 }}>
                                    Generate on-grid, off-grid, hybrid solar proposals or Apollo structure quotations customized with your company stamp, logo, and bank details.
                                </Typography>
                                <Button
                                    variant="contained"
                                    size="large"
                                    startIcon={<AddCircleOutlineIcon />}
                                    onClick={() => router.push('/')}
                                    sx={{
                                        bgcolor: '#ff9800',
                                        '&:hover': { bgcolor: '#f57c00' },
                                        fontWeight: 800,
                                        borderRadius: 2,
                                        px: 3,
                                        py: 1.2,
                                        boxShadow: '0 8px 20px rgba(255,152,0,0.3)',
                                    }}
                                >
                                    Open Quotation Builder
                                </Button>
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <Typography variant="caption" sx={{ color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                                        Active Shop Stamp & Signature
                                    </Typography>
                                    <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                        <Box
                                            component="img"
                                            src={vendor?.signature_url || '/signature.png'}
                                            alt="Stamp"
                                            sx={{ height: 48, objectFit: 'contain', bgcolor: '#fff', p: 0.5, borderRadius: 1 }}
                                        />
                                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff' }}>
                                            {vendor?.authorized_signatory || 'Authorized Signatory'}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>

                {/* Metrics */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <Card sx={{ borderRadius: 3, borderLeft: '5px solid #ff9800', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                            <CardContent>
                                <Typography variant="h3" sx={{ fontWeight: 900, color: '#ff9800' }}>
                                    {stats.totalQuotes}
                                </Typography>
                                <Typography variant="subtitle2" sx={{ color: '#64748b', fontWeight: 600 }}>
                                    Total Generated Quotes
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <Card sx={{ borderRadius: 3, borderLeft: '5px solid #10b981', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                            <CardContent>
                                <Typography variant="h3" sx={{ fontWeight: 900, color: '#10b981' }}>
                                    {stats.sentQuotes}
                                </Typography>
                                <Typography variant="subtitle2" sx={{ color: '#64748b', fontWeight: 600 }}>
                                    Dispatched / Closed Quotes
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <Card sx={{ borderRadius: 3, borderLeft: '5px solid #6366f1', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                            <CardContent>
                                <Typography variant="h3" sx={{ fontWeight: 900, color: '#6366f1' }}>
                                    {stats.draftQuotes}
                                </Typography>
                                <Typography variant="subtitle2" sx={{ color: '#64748b', fontWeight: 600 }}>
                                    Draft Proposals
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Recent Quotations Section */}
                <Card sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                    <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b' }}>
                                Recent Customer Quotations
                            </Typography>
                            <Button
                                endIcon={<ArrowForwardIcon />}
                                onClick={() => router.push('/admin/quotations')}
                                sx={{ color: '#ff9800', fontWeight: 700 }}
                            >
                                View All Quotes
                            </Button>
                        </Box>

                        {loading ? (
                            <Box sx={{ py: 4, textAlign: 'center' }}>
                                <CircularProgress size={30} />
                            </Box>
                        ) : recentQuotes.length === 0 ? (
                            <Box sx={{ py: 6, textAlign: 'center' }}>
                                <ReceiptLongIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1 }} />
                                <Typography variant="body1" sx={{ color: '#64748b', fontWeight: 600 }}>
                                    No quotations generated yet.
                                </Typography>
                                <Button
                                    variant="outlined"
                                    onClick={() => router.push('/')}
                                    sx={{ mt: 2, color: '#ff9800', borderColor: '#ff9800', fontWeight: 700 }}
                                >
                                    Create Your First Quotation
                                </Button>
                            </Box>
                        ) : (
                            <Stack spacing={2}>
                                {recentQuotes.map((q) => (
                                    <Box
                                        key={q.id}
                                        sx={{
                                            p: 2,
                                            borderRadius: 2,
                                            bgcolor: '#f8fafc',
                                            border: '1px solid #e2e8f0',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            flexWrap: 'wrap',
                                            gap: 2,
                                        }}
                                    >
                                        <Box>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1e293b' }}>
                                                {q.customer_name}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#64748b' }}>
                                                {q.quote_number || 'Quote'} &bull; {q.capacity_kw ? `${q.capacity_kw} kW` : ''} &bull; {new Date(q.created_at).toLocaleDateString()}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1e3a5f' }}>
                                                ₹{Number(q.total_amount || 0).toLocaleString('en-IN')}
                                            </Typography>
                                            <Chip
                                                label={q.status || 'draft'}
                                                size="small"
                                                color={q.status === 'WhatsApp Sent' || q.status === 'sent' ? 'success' : 'default'}
                                                sx={{ textTransform: 'capitalize', fontWeight: 600 }}
                                            />
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                color="info"
                                                onClick={() => window.open(`/api/quote/view/${encodeURIComponent(q.quote_number || q.id)}`, '_blank')}
                                                startIcon={<PictureAsPdfIcon />}
                                                sx={{ textTransform: 'none', fontWeight: 700 }}
                                            >
                                                View PDF
                                            </Button>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                onClick={() => router.push(`/?edit=${q.id}`)}
                                                startIcon={<EditNoteIcon />}
                                                sx={{ textTransform: 'none', fontWeight: 700 }}
                                            >
                                                Edit / Print
                                            </Button>
                                            <Button
                                                size="small"
                                                variant="contained"
                                                onClick={() => handleShareWhatsApp(q)}
                                                startIcon={<WhatsAppIcon />}
                                                sx={{
                                                    bgcolor: '#25D366',
                                                    '&:hover': { bgcolor: '#128C7E' },
                                                    textTransform: 'none',
                                                    fontWeight: 700,
                                                }}
                                            >
                                                WhatsApp
                                            </Button>
                                        </Box>
                                    </Box>
                                ))}
                            </Stack>
                        )}
                    </CardContent>
                </Card>
            </Container>
        </Box>
    );
}
