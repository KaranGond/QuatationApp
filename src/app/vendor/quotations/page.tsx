'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress, Typography } from '@mui/material';

export default function VendorQuotationsRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/admin/quotations');
    }, [router]);

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <CircularProgress size={32} sx={{ color: '#2563eb' }} />
            <Typography variant="body2" color="text.secondary">
                Opening Quotation Management...
            </Typography>
        </Box>
    );
}
