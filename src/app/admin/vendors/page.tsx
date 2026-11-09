'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Container,
    Box,
    Typography,
    Card,
    CardContent,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Grid,
    IconButton,
    Alert,
    CircularProgress,
    Tooltip,
    Stack,
    Divider,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    InputAdornment,
} from '@mui/material';
import AddBusinessIcon from '@mui/icons-material/AddBusiness';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import KeyIcon from '@mui/icons-material/Key';
import StorefrontIcon from '@mui/icons-material/Storefront';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import SaveIcon from '@mui/icons-material/Save';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import VerifiedIcon from '@mui/icons-material/Verified';
import LaunchIcon from '@mui/icons-material/Launch';
import ReceiptIcon from '@mui/icons-material/Receipt';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import CheckIcon from '@mui/icons-material/Check';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/apiFetch';

export default function AdminVendorsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialVendorParam = searchParams.get('vendor_id');

    const { switchVendor } = useAuth();

    const consoleRef = useRef<HTMLDivElement>(null);
    const tableRef = useRef<HTMLDivElement>(null);
    const [vendors, setVendors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Dialog state for creating new vendor
    const [dialogOpen, setDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Remote Control Active Selected Vendor
    const [remoteVendorId, setRemoteVendorId] = useState<string>('');
    const [remoteVendor, setRemoteVendor] = useState<any | null>(null);
    const [remoteSaving, setRemoteSaving] = useState(false);
    const [remoteSuccess, setRemoteSuccess] = useState('');
    const [remoteError, setRemoteError] = useState('');

    // Remote Control Form Fields
    const [rcName, setRcName] = useState('');
    const [rcNodeId, setRcNodeId] = useState('');
    const [rcQuotePrefix, setRcQuotePrefix] = useState('QT');
    const [rcQrCodeUrl, setRcQrCodeUrl] = useState('');
    const [rcIsDemo, setRcIsDemo] = useState(false);
    const [rcPlanTier, setRcPlanTier] = useState('pro');
    const [rcStatus, setRcStatus] = useState<'active' | 'suspended'>('active');
    const [rcTagline, setRcTagline] = useState('');
    const [rcPhone, setRcPhone] = useState('');
    const [rcAlternatePhone, setRcAlternatePhone] = useState('');
    const [rcEmail, setRcEmail] = useState('');
    const [rcSignatory, setRcSignatory] = useState('');
    const [rcGstin, setRcGstin] = useState('');
    const [rcHeadOffice, setRcHeadOffice] = useState('');
    const [rcRegisteredOffice, setRcRegisteredOffice] = useState('');
    const [rcBankName, setRcBankName] = useState('');
    const [rcBankBranch, setRcBankBranch] = useState('');
    const [rcAccountName, setRcAccountName] = useState('');
    const [rcAccountNumber, setRcAccountNumber] = useState('');
    const [rcIfsc, setRcIfsc] = useState('');
    const [rcUpiId, setRcUpiId] = useState('');
    const [rcLogoUrl, setRcLogoUrl] = useState('/logo.png');
    const [rcSignatureUrl, setRcSignatureUrl] = useState('/signature.png');
    const [rcStampUrl, setRcStampUrl] = useState('/stamp.png');
    const [rcResetPassword, setRcResetPassword] = useState('');
    const [rcShowPassword, setRcShowPassword] = useState(false);

    // Dedicated Credentials Modal State
    const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
    const [credVendor, setCredVendor] = useState<any | null>(null);
    const [credEmail, setCredEmail] = useState('');
    const [credPassword, setCredPassword] = useState('');
    const [credShowPassword, setCredShowPassword] = useState(false);
    const [credRole, setCredRole] = useState<'vendor' | 'salesperson'>('vendor');
    const [credSaving, setCredSaving] = useState(false);
    const [credSuccess, setCredSuccess] = useState('');
    const [credError, setCredError] = useState('');
    const [copiedText, setCopiedText] = useState(false);
    const [modalShowPassword, setModalShowPassword] = useState(false);

    // Upload refs for remote control
    const rcLogoInputRef = useRef<HTMLInputElement>(null);
    const rcSigInputRef = useRef<HTMLInputElement>(null);
    const rcQrInputRef = useRef<HTMLInputElement>(null);
    const [uploadingRcAsset, setUploadingRcAsset] = useState<string | null>(null);

    // Create Modal Form Fields
    const [modalName, setModalName] = useState('');
    const [modalNodeId, setModalNodeId] = useState('');
    const [modalQuotePrefix, setModalQuotePrefix] = useState('');
    const [modalEmail, setModalEmail] = useState('');
    const [modalPassword, setModalPassword] = useState('');
    const [modalPhone, setModalPhone] = useState('');
    const [modalSignatory, setModalSignatory] = useState('');
    const [modalGstin, setModalGstin] = useState('');
    const [modalHeadOffice, setModalHeadOffice] = useState('');
    const [modalBankName, setModalBankName] = useState('');
    const [modalAccountName, setModalAccountName] = useState('');
    const [modalAccountNumber, setModalAccountNumber] = useState('');
    const [modalIfsc, setModalIfsc] = useState('');
    const [modalUpiId, setModalUpiId] = useState('');
    const [modalDefaultMargin, setModalDefaultMargin] = useState(0);

    const loadVendors = async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/api/vendors');
            const json = await res.json();
            if (json.success) {
                const list = json.data || [];
                setVendors(list);

                // Auto select vendor for Remote Control
                if (list.length > 0) {
                    const targetId = initialVendorParam || remoteVendorId || list[0].id;
                    const found = list.find((v: any) => v.id === targetId) || list[0];
                    selectVendorForRemoteControl(found);
                }
            }
        } catch (err) {
            console.error('Failed to load vendors:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadVendors();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialVendorParam]);

    const selectVendorForRemoteControl = (v: any) => {
        if (!v) return;
        setRemoteVendorId(v.id);
        setRemoteVendor(v);
        setRcName(v.name || '');
        setRcNodeId(v.node_id || 'NODE-VNS-001');
        setRcQuotePrefix(v.quote_prefix || 'KSS');
        setRcQrCodeUrl(v.qr_code_url || '');
        setRcIsDemo(Boolean(v.is_demo));
        setRcPlanTier(v.plan_tier || 'pro');
        setRcStatus((v.status as any) || 'active');
        setRcTagline(v.tagline || '');
        setRcPhone(v.phone || '');
        const existingUserEmail = v.vendor_users?.[0]?.email || v.email || '';
        setRcEmail(existingUserEmail);
        setRcSignatory(v.authorized_signatory || '');
        setRcGstin(v.gstin || '');
        setRcHeadOffice(v.head_office || '');
        setRcRegisteredOffice(v.registered_office || '');
        setRcBankName(v.bank_name || '');
        setRcBankBranch(v.bank_branch || '');
        setRcAccountName(v.account_name || '');
        setRcAccountNumber(v.account_number || '');
        setRcIfsc(v.ifsc || '');
        setRcUpiId(v.upi_id || '');
        setRcLogoUrl(v.logo_url || '/logo.png');
        setRcSignatureUrl(v.signature_url || '/signature.png');
        setRcStampUrl(v.stamp_url || '/stamp.png');
        setRcResetPassword('');

        setRemoteError('');
        setRemoteSuccess('');
    };

    const handleRemoteSelectChange = (vendorId: string) => {
        const found = vendors.find(v => v.id === vendorId);
        if (found) {
            selectVendorForRemoteControl(found);
        }
    };

    // Upload Asset from Admin Remote Control
    const handleRemoteUpload = async (file: File, type: 'logo' | 'signature' | 'stamp' | 'qr') => {
        if (!remoteVendorId) return;
        setUploadingRcAsset(type);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', type);
            formData.append('vendor_id', remoteVendorId);

            const res = await apiFetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.success) {
                if (res.status === 401 || json.message?.includes('Authentication required')) {
                    throw new Error('Your administrator session has expired or requires sign in. Please refresh the page or sign in again as Super Admin.');
                }
                throw new Error(json.message || `Operation failed (${res.status})`);
            }

            if (type === 'logo') setRcLogoUrl(json.url);
            if (type === 'signature' || type === 'stamp') {
                setRcSignatureUrl(json.url);
                setRcStampUrl(json.url);
            }
            if (type === 'qr') setRcQrCodeUrl(json.url);

            setRemoteSuccess(`${type === 'signature' ? 'STAMP & SIGNATURE' : type.toUpperCase()} uploaded to tenant vault and updated successfully!`);
        } catch (err: any) {
            setRemoteError(err.message || 'Upload failed');
        } finally {
            setUploadingRcAsset(null);
        }
    };

    // Save Remote Control Updates
    const handleSaveRemote = async () => {
        if (!remoteVendorId) return;
        setRemoteSaving(true);
        setRemoteError('');
        setRemoteSuccess('');

        try {
            const payload: any = {
                id: remoteVendorId,
                name: rcName.trim(),
                tagline: rcTagline.trim() || null,
                phone: rcPhone.trim() || null,
                alternate_phone: rcAlternatePhone.trim() || null,
                email: rcEmail.trim() || null,
                authorized_signatory: rcSignatory.trim() || null,
                gstin: rcGstin.trim() || null,
                head_office: rcHeadOffice.trim() || null,
                registered_office: rcRegisteredOffice.trim() || null,
                bank_name: rcBankName.trim() || null,
                bank_branch: rcBankBranch.trim() || null,
                account_name: rcAccountName.trim() || null,
                account_number: rcAccountNumber.trim() || null,
                ifsc: rcIfsc.trim() || null,
                upi_id: rcUpiId.trim() || null,
                logo_url: rcLogoUrl,
                signature_url: rcSignatureUrl,
                stamp_url: rcStampUrl,
                qr_code_url: rcQrCodeUrl || null,
                node_id: rcNodeId.trim(),
                quote_prefix: rcQuotePrefix.trim().toUpperCase(),
                is_demo: rcIsDemo,
                plan_tier: rcPlanTier,
                status: rcStatus,
                default_margin: remoteVendor?.default_margin ?? 0,
                components_settings: remoteVendor?.components_settings ?? {},
            };

            if (rcResetPassword.trim().length >= 6) {
                payload.password = rcResetPassword.trim();
                payload.login_email = rcEmail.trim();
            } else if (rcEmail.trim()) {
                payload.login_email = rcEmail.trim();
            }

            const res = await apiFetch('/api/vendors', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.success) {
                if (res.status === 401 || json.message?.includes('Authentication required')) {
                    throw new Error('Your administrator session has expired or requires sign in. Please refresh the page or sign in again as Super Admin.');
                }
                throw new Error(json.message || `Operation failed (${res.status})`);
            }

            setRemoteSuccess(`Settings for "${rcName}" updated successfully! Changes are immediately live in their workspace.`);
            setRcResetPassword('');
            if (json.data) setRemoteVendor(json.data);

            // Reload vendors in background
            const reloadRes = await apiFetch('/api/vendors');
            const reloadJson = await reloadRes.json();
            if (reloadJson.success) setVendors(reloadJson.data || []);
        } catch (err: any) {
            setRemoteError(err.message || 'Failed to update vendor settings');
        } finally {
            setRemoteSaving(false);
        }
    };

    // Helper to generate secure random password
    const generateSecurePassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `Solar@${result}!`;
    };

    // Helper to copy WhatsApp/Email shareable login credentials
    const copyLoginDetailsToClipboard = (vendorName: string, email: string, pwd?: string) => {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
        const text = `🌞 *${vendorName} — Solar Quotation Portal Access*\n\n` +
            `🌐 *Portal Login:* ${origin}/login\n` +
            `👤 *User ID (Email):* ${email}\n` +
            `${pwd ? `🔑 *Password:* ${pwd}\n` : ''}\n` +
            `Use these credentials to log in, customize your logo & signature, and start generating customer quotes.`;
        navigator.clipboard.writeText(text);
        setCopiedText(true);
        setTimeout(() => setCopiedText(false), 3000);
    };

    // One-click quick save credentials directly from Remote Control card
    const handleQuickSaveCredentials = async () => {
        if (!remoteVendorId) return;
        if (!rcEmail || !rcEmail.includes('@')) {
            setRemoteError('Please enter a valid User ID / Login Email');
            return;
        }
        if (!rcResetPassword || rcResetPassword.trim().length < 6) {
            setRemoteError('Password must be at least 6 characters');
            return;
        }
        setRemoteSaving(true);
        setRemoteError('');
        setRemoteSuccess('');
        try {
            const res = await apiFetch('/api/vendors', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: remoteVendorId,
                    login_email: rcEmail.trim(),
                    password: rcResetPassword.trim(),
                }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.success) {
                if (res.status === 401 || json.message?.includes('Authentication required')) {
                    throw new Error('Your administrator session has expired or requires sign in. Please refresh the page or sign in again as Super Admin.');
                }
                throw new Error(json.message || `Operation failed (${res.status})`);
            }
            setRemoteSuccess(`Login credentials activated for ${rcName}! User ID: ${rcEmail.trim()}`);
            setRcResetPassword('');
            loadVendors();
        } catch (err: any) {
            setRemoteError(err.message || 'Failed to update credentials');
        } finally {
            setRemoteSaving(false);
        }
    };

    // Dedicated Credentials Modal Open & Save
    const openCredentialsModal = (v: any) => {
        setCredVendor(v);
        const existingUser = v.vendor_users?.[0];
        setCredEmail(existingUser?.email || v.email || '');
        setCredPassword('');
        setCredRole(existingUser?.role || 'vendor');
        setCredSuccess('');
        setCredError('');
        setCopiedText(false);
        setCredentialsModalOpen(true);
    };

    const handleSaveCredentialsModal = async () => {
        if (!credVendor) return;
        if (!credEmail || !credEmail.includes('@')) {
            setCredError('Please provide a valid login email / User ID');
            return;
        }
        if (!credPassword || credPassword.trim().length < 6) {
            setCredError('Password must be at least 6 characters long');
            return;
        }

        setCredSaving(true);
        setCredError('');
        setCredSuccess('');
        try {
            const res = await apiFetch('/api/vendors', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: credVendor.id,
                    login_email: credEmail.trim(),
                    password: credPassword.trim(),
                    role: credRole,
                }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.success) {
                if (res.status === 401 || json.message?.includes('Authentication required')) {
                    throw new Error('Your administrator session has expired or requires sign in. Please refresh the page or sign in again as Super Admin.');
                }
                throw new Error(json.message || `Operation failed (${res.status})`);
            }

            setCredSuccess(`Credentials activated! User ID: ${credEmail.trim()}`);
            loadVendors();
        } catch (err: any) {
            setCredError(err.message || 'Failed to update credentials');
        } finally {
            setCredSaving(false);
        }
    };

    // Open Modal for New Vendor Creation
    const handleOpenCreate = () => {
        setModalName('');
        setModalNodeId('');
        setModalQuotePrefix('');
        setModalEmail('');
        setModalPassword('');
        setModalPhone('');
        setModalSignatory('');
        setModalGstin('');
        setModalHeadOffice('');
        setModalBankName('');
        setModalAccountName('');
        setModalAccountNumber('');
        setModalIfsc('');
        setModalUpiId('');
        setModalDefaultMargin(0);
        setErrorMsg('');
        setDialogOpen(true);
    };

    const handleCreateVendor = async () => {
        if (!modalName.trim()) {
            setErrorMsg('Vendor / Company name is required');
            return;
        }

        setSaving(true);
        setErrorMsg('');
        setSuccessMsg('');

        try {
            const res = await apiFetch('/api/vendors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: modalName.trim(),
                    node_id: modalNodeId.trim() || undefined,
                    quote_prefix: modalQuotePrefix.trim().toUpperCase() || undefined,
                    email: modalEmail.trim() || null,
                    password: modalPassword.trim() || null,
                    phone: modalPhone.trim() || null,
                    authorized_signatory: modalSignatory.trim() || null,
                    gstin: modalGstin.trim() || null,
                    head_office: modalHeadOffice.trim() || null,
                    bank_name: modalBankName.trim() || null,
                    account_name: modalAccountName.trim() || null,
                    account_number: modalAccountNumber.trim() || null,
                    ifsc: modalIfsc.trim() || null,
                    upi_id: modalUpiId.trim() || null,
                    default_margin: Number(modalDefaultMargin) || 0,
                }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.success) {
                if (res.status === 401 || json.message?.includes('Authentication required')) {
                    throw new Error('Your administrator session has expired or requires sign in. Please refresh the page or sign in again as Super Admin.');
                }
                throw new Error(json.message || `Operation failed (${res.status})`);
            }

            setSuccessMsg(`Vendor "${modalName}" created with login credentials!`);
            setDialogOpen(false);
            loadVendors();
        } catch (err: any) {
            setErrorMsg(err.message || 'Operation failed');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = async (v: any) => {
        const isCurrentlySuspended = v.status === 'suspended';
        const actionLabel = isCurrentlySuspended ? 'Resume / Activate' : 'Suspend';
        const confirmMsg = isCurrentlySuspended
            ? `Do you want to re-activate and resume vendor "${v.name}"? They will regain full access to generate quotations.`
            : `Are you sure you want to suspend vendor "${v.name}"? Their workspace will be put on hold.`;

        if (!confirm(confirmMsg)) return;

        try {
            const nextStatus = isCurrentlySuspended ? 'active' : 'suspended';
            const res = await apiFetch(`/api/vendors?id=${v.id}&action=${isCurrentlySuspended ? 'resume' : 'suspend'}`, {
                method: 'DELETE',
            });
            const json = await res.json();
            if (json.success) {
                if (remoteVendorId === v.id) {
                    setRcStatus(nextStatus);
                    setRemoteVendor((prev: any) => prev ? { ...prev, status: nextStatus } : prev);
                }
                setSuccessMsg(`Vendor "${v.name}" ${isCurrentlySuspended ? 'resumed and activated' : 'suspended'} successfully!`);
                loadVendors();
            } else {
                setErrorMsg(json.message || `Failed to ${actionLabel.toLowerCase()} vendor`);
            }
        } catch (err: any) {
            console.error(`Failed to update vendor status:`, err);
            setErrorMsg(err.message || 'Error updating vendor status');
        }
    };

    const handleSimulate = (v: any) => {
        switchVendor(v);
        router.push('/');
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#f4f6f8', py: 3 }}>
            <Container maxWidth="xl">
                {/* Header */}
                <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Button
                            variant="outlined"
                            startIcon={<ArrowBackIcon />}
                            onClick={() => router.push('/admin')}
                            sx={{ borderColor: '#cbd5e1', color: '#475569' }}
                        >
                            Overview
                        </Button>
                        <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a' }}>
                                    Vendors & Live Remote Control
                                </Typography>
                                <Chip label="Layer 1 Master Console" size="small" sx={{ bgcolor: '#0f172a', color: '#fff', fontWeight: 800 }} />
                                <Chip label={`${vendors.length} Active Tenants`} size="small" sx={{ bgcolor: '#eff6ff', color: '#2563eb', fontWeight: 700 }} />
                            </Box>
                            <Typography variant="body2" sx={{ color: '#64748b' }}>
                                Multi-tenant directory of all vendors, credentials, banking, brand assets & live phone call remote control
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                        <Button
                            variant="outlined"
                            startIcon={<PhoneInTalkIcon />}
                            onClick={() => consoleRef.current?.scrollIntoView({ behavior: 'smooth' })}
                            sx={{ borderColor: '#2563eb', color: '#2563eb', fontWeight: 700 }}
                        >
                            Jump to Live Console
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<AddBusinessIcon />}
                            onClick={handleOpenCreate}
                            sx={{ bgcolor: '#ff9800', '&:hover': { bgcolor: '#f57c00' }, fontWeight: 700 }}
                        >
                            Register New Vendor
                        </Button>
                    </Box>
                </Box>

                {/* ALL VENDORS DIRECTORY TABLE */}
                <Box ref={tableRef} sx={{ mb: 4 }}>
                    {successMsg && (
                        <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setSuccessMsg('')}>
                            {successMsg}
                        </Alert>
                    )}

                    <Card sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                        <Box sx={{ p: 2.5, bgcolor: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                    <StorefrontIcon sx={{ fontSize: 22 }} />
                                </Box>
                                <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                                        All Multi-Tenant Vendors Directory
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                                        Click <strong>&quot;Manage on Call&quot;</strong> on any vendor to load &amp; adjust their settings in the console below
                                    </Typography>
                                </Box>
                            </Box>
                            <Chip
                                label={`${vendors.length} Total Registered Nodes`}
                                size="small"
                                sx={{ bgcolor: '#f1f5f9', color: '#334155', fontWeight: 700 }}
                            />
                        </Box>
                        <TableContainer>
                            <Table>
                                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 700 }}>Vendor / Company</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Tenant Node ID</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Prefix</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Login User ID</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Contact Info</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>GSTIN</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Margin / kW</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Quotes</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {vendors.map((v) => {
                                        const isSelected = v.id === remoteVendorId;
                                        return (
                                            <TableRow
                                                key={v.id}
                                                hover
                                                sx={{
                                                    bgcolor: isSelected ? 'rgba(37, 99, 235, 0.05)' : undefined,
                                                    borderLeft: isSelected ? '4px solid #2563eb' : '4px solid transparent',
                                                    transition: 'all 0.2s',
                                                }}
                                            >
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                        <Box
                                                            component="img"
                                                            src={v.logo_url || '/logo.png'}
                                                            alt="Logo"
                                                            sx={{ width: 36, height: 36, objectFit: 'contain', bgcolor: '#f1f5f9', borderRadius: 1.5, p: 0.5 }}
                                                            onError={(e: any) => { e.target.src = '/logo.png'; }}
                                                        />
                                                        <Box>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                                                                    {v.name}
                                                                </Typography>
                                                                {v.is_demo && (
                                                                    <Chip label="Demo Flagship" size="small" sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 800, fontSize: 10, height: 20 }} />
                                                                )}
                                                            </Box>
                                                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                                                                Signatory: {v.authorized_signatory || 'N/A'}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={v.node_id || 'NODE-VNS-001'}
                                                        size="small"
                                                        sx={{ bgcolor: '#0f172a', color: '#38bdf8', fontWeight: 800, fontFamily: 'monospace', fontSize: 11 }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={v.quote_prefix || 'QT'}
                                                        size="small"
                                                        sx={{ bgcolor: '#f0f9ff', color: '#0369a1', fontWeight: 700, fontSize: 11 }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {v.vendor_users && v.vendor_users.length > 0 ? (
                                                        <Box>
                                                            <Chip
                                                                icon={<KeyIcon sx={{ fontSize: '13px !important', color: '#7c3aed !important' }} />}
                                                                label={v.vendor_users[0].email}
                                                                size="small"
                                                                sx={{ bgcolor: '#f5f3ff', color: '#6d28d9', fontWeight: 700, fontFamily: 'monospace', fontSize: 11.5 }}
                                                            />
                                                            {v.vendor_users.length > 1 && (
                                                                <Typography variant="caption" sx={{ display: 'block', color: '#64748b', fontSize: 10 }}>
                                                                    +{v.vendor_users.length - 1} more
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    ) : (
                                                        <Chip
                                                            label="No Login Yet"
                                                            size="small"
                                                            sx={{ bgcolor: '#fff7ed', color: '#c2410c', fontWeight: 600, fontSize: 11 }}
                                                        />
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2">{v.phone || '-'}</Typography>
                                                    <Typography variant="caption" sx={{ color: '#64748b' }}>{v.email || '-'}</Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                        {v.gstin || '-'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={`₹${v.default_margin || 0}/kW`}
                                                        size="small"
                                                        sx={{ bgcolor: '#ecfdf5', color: '#059669', fontWeight: 700 }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        icon={<ReceiptIcon sx={{ fontSize: '13px !important' }} />}
                                                        label={v.quotations?.[0]?.count ?? 0}
                                                        size="small"
                                                        sx={{ bgcolor: '#eff6ff', color: '#2563eb', fontWeight: 700 }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={v.status || 'active'}
                                                        size="small"
                                                        color={v.status === 'suspended' ? 'error' : 'success'}
                                                        sx={{ fontWeight: 700, textTransform: 'capitalize' }}
                                                    />
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Stack direction="row" spacing={0.75} justifyContent="center" alignItems="center">
                                                        <Tooltip title={isSelected ? "Currently Active in Console Below" : `Manage ${v.name} Live on Call`}>
                                                            <Button
                                                                size="small"
                                                                variant={isSelected ? "contained" : "outlined"}
                                                                startIcon={<PhoneInTalkIcon sx={{ fontSize: 15 }} />}
                                                                onClick={() => {
                                                                    selectVendorForRemoteControl(v);
                                                                    consoleRef.current?.scrollIntoView({ behavior: 'smooth' });
                                                                }}
                                                                sx={{
                                                                    textTransform: 'none',
                                                                    fontWeight: 700,
                                                                    fontSize: 12,
                                                                    py: 0.35,
                                                                    px: 1.2,
                                                                    borderRadius: 1.5,
                                                                    bgcolor: isSelected ? '#2563eb' : 'transparent',
                                                                    borderColor: '#2563eb',
                                                                    color: isSelected ? '#fff' : '#2563eb',
                                                                    boxShadow: isSelected ? '0 2px 8px rgba(37,99,235,0.3)' : 'none',
                                                                    '&:hover': {
                                                                        bgcolor: isSelected ? '#1d4ed8' : '#eff6ff',
                                                                    }
                                                                }}
                                                            >
                                                                {isSelected ? 'Active on Call' : 'Manage on Call'}
                                                            </Button>
                                                        </Tooltip>
                                                        <Tooltip title="Set / Reset User ID & Password">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => openCredentialsModal(v)}
                                                                sx={{ color: '#7c3aed', bgcolor: '#f5f3ff', '&:hover': { bgcolor: '#ede9fe' } }}
                                                            >
                                                                <KeyIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Simulate Vendor in Quotation Builder">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleSimulate(v)}
                                                                sx={{ color: '#ff9800', bgcolor: '#fffbeb', '&:hover': { bgcolor: '#fef3c7' } }}
                                                            >
                                                                <VisibilityIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        {v.status === 'suspended' ? (
                                                            <Tooltip title={`Resume / Re-activate ${v.name}`}>
                                                                <Button
                                                                    size="small"
                                                                    variant="contained"
                                                                    startIcon={<PlayCircleOutlineIcon sx={{ fontSize: 16 }} />}
                                                                    onClick={() => handleToggleStatus(v)}
                                                                    sx={{
                                                                        textTransform: 'none',
                                                                        fontWeight: 700,
                                                                        fontSize: 11,
                                                                        py: 0.35,
                                                                        px: 1.2,
                                                                        borderRadius: 1.5,
                                                                        bgcolor: '#16a34a',
                                                                        color: '#fff',
                                                                        '&:hover': { bgcolor: '#15803d' },
                                                                        boxShadow: '0 2px 6px rgba(22,163,74,0.3)',
                                                                    }}
                                                                >
                                                                    Resume
                                                                </Button>
                                                            </Tooltip>
                                                        ) : (
                                                            <Tooltip title={`Suspend ${v.name}`}>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => handleToggleStatus(v)}
                                                                    sx={{
                                                                        color: '#ef4444',
                                                                        bgcolor: '#fef2f2',
                                                                        border: '1px solid #fee2e2',
                                                                        '&:hover': { bgcolor: '#fee2e2' }
                                                                    }}
                                                                >
                                                                    <PauseCircleOutlineIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                    </Stack>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Card>
                </Box>

                {/* LIVE CALL REMOTE CONTROL CONSOLE */}
                <Box ref={consoleRef} sx={{ pt: 1, mb: 4 }}>
                    {/* Vendor Dropdown Selector Bar */}
                    <Card sx={{ mb: 3, borderRadius: 3, border: '2px solid #2563eb', bgcolor: '#eff6ff', boxShadow: '0 4px 20px rgba(37,99,235,0.1)' }}>
                            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                                <Grid container spacing={2} alignItems="center">
                                    <Grid size={{ xs: 12, md: 5 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                            <Box
                                                sx={{
                                                    width: 44,
                                                    height: 44,
                                                    borderRadius: 2,
                                                    bgcolor: '#2563eb',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#fff',
                                                    boxShadow: '0 4px 10px rgba(37,99,235,0.3)',
                                                }}
                                            >
                                                <PhoneInTalkIcon sx={{ fontSize: 24 }} />
                                            </Box>
                                            <Box>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1e3a8a', lineHeight: 1.2 }}>
                                                    Active Vendor On-Call Selector
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: '#3b82f6', fontWeight: 600 }}>
                                                    Instantly loads credentials, banking, and brand assets for live phone discussion
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Grid>

                                    <Grid size={{ xs: 12, md: 4 }}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel sx={{ fontWeight: 700 }}>Choose Vendor to Manage</InputLabel>
                                            <Select
                                                value={remoteVendorId}
                                                label="Choose Vendor to Manage"
                                                onChange={(e) => handleRemoteSelectChange(e.target.value)}
                                                sx={{ bgcolor: '#fff', fontWeight: 700 }}
                                            >
                                                {vendors.map((v) => (
                                                    <MenuItem key={v.id} value={v.id}>
                                                        🏢 {v.name} {v.phone ? `(${v.phone})` : ''}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Grid>

                                    <Grid size={{ xs: 12, md: 3 }} sx={{ display: 'flex', gap: 1, justifyContent: { xs: 'flex-start', md: 'flex-end' }, flexWrap: 'wrap' }}>
                                        <Button
                                            variant="outlined"
                                            startIcon={<StorefrontIcon sx={{ fontSize: 16 }} />}
                                            onClick={() => tableRef.current?.scrollIntoView({ behavior: 'smooth' })}
                                            sx={{ borderColor: '#93c5fd', color: '#1e40af', fontWeight: 700, bgcolor: '#fff' }}
                                            size="small"
                                        >
                                            Directory
                                        </Button>

                                        <Button
                                            variant="contained"
                                            startIcon={remoteSaving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <SaveIcon />}
                                            onClick={handleSaveRemote}
                                            disabled={remoteSaving || !remoteVendorId}
                                            sx={{ bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' }, fontWeight: 700 }}
                                        >
                                            {remoteSaving ? 'Saving...' : 'Save Changes'}
                                        </Button>

                                        {remoteVendor && (
                                            <Button
                                                variant="outlined"
                                                endIcon={<LaunchIcon sx={{ fontSize: 14 }} />}
                                                onClick={() => handleSimulate(remoteVendor)}
                                                sx={{ borderColor: '#2563eb', color: '#2563eb', fontWeight: 700, bgcolor: '#fff' }}
                                                title="Open Quotation Builder simulating this vendor"
                                            >
                                                Builder
                                            </Button>
                                        )}
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>

                        {remoteSuccess && (
                            <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setRemoteSuccess('')}>
                                {remoteSuccess}
                            </Alert>
                        )}

                        {remoteError && (
                            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setRemoteError('')}>
                                {remoteError}
                            </Alert>
                        )}

                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                                <CircularProgress />
                            </Box>
                        ) : !remoteVendor ? (
                            <Box sx={{ textAlign: 'center', py: 6 }}>
                                <Typography color="text.secondary">No vendor selected.</Typography>
                            </Box>
                        ) : (
                            <>
                                {rcStatus === 'suspended' && (
                                    <Alert
                                        severity="error"
                                        sx={{ mb: 3, borderRadius: 2, alignItems: 'center', bgcolor: '#fef2f2', border: '1px solid #fecaca' }}
                                        action={
                                            <Button
                                                color="success"
                                                size="small"
                                                variant="contained"
                                                startIcon={<PlayCircleOutlineIcon />}
                                                onClick={() => handleToggleStatus(remoteVendor)}
                                                sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}
                                            >
                                                Resume Vendor Workspace
                                            </Button>
                                        }
                                    >
                                        <strong>⚠️ This vendor is currently SUSPENDED.</strong> Their workspace and quotation creation are paused. Click to resume them.
                                    </Alert>
                                )}
                                <Grid container spacing={3}>
                                {/* Left Column: Components, Pricing & Credentials */}
                                <Grid size={{ xs: 12, md: 6 }}>
                                    {/* 1. Customer Vendor Login Credentials */}
                                    <Card sx={{ mb: 3, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', borderTop: '4px solid #7c3aed' }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <KeyIcon sx={{ color: '#7c3aed' }} />
                                                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b' }}>
                                                        Customer Vendor Login Credentials (User ID & Password)
                                                    </Typography>
                                                </Box>
                                                {remoteVendor?.vendor_users && remoteVendor.vendor_users.length > 0 ? (
                                                    <Chip
                                                        icon={<CheckCircleOutlineIcon sx={{ fontSize: '14px !important' }} />}
                                                        label={`Active User ID: ${remoteVendor.vendor_users[0].email}`}
                                                        size="small"
                                                        sx={{ bgcolor: '#f5f3ff', color: '#7c3aed', fontWeight: 700 }}
                                                    />
                                                ) : (
                                                    <Chip
                                                        label="⚠️ No Login Account Activated"
                                                        size="small"
                                                        sx={{ bgcolor: '#fff7ed', color: '#c2410c', fontWeight: 700 }}
                                                    />
                                                )}
                                            </Box>
                                            <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                                                Create or update the User ID (email) and password for this customer vendor so they can log in at <code>/login</code>.
                                            </Typography>

                                            <Grid container spacing={2}>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <TextField
                                                        fullWidth
                                                        label="Vendor User ID (Login Email) *"
                                                        type="email"
                                                        value={rcEmail}
                                                        onChange={(e) => setRcEmail(e.target.value)}
                                                        helperText="Vendor logs in with this email"
                                                        InputProps={{
                                                            startAdornment: (
                                                                <InputAdornment position="start">
                                                                    <PersonIcon sx={{ color: '#7c3aed', fontSize: 20 }} />
                                                                </InputAdornment>
                                                            ),
                                                        }}
                                                    />
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                                                            Password (Min 6 characters)
                                                        </Typography>
                                                        <Button
                                                            size="small"
                                                            startIcon={<AutoAwesomeIcon sx={{ fontSize: 13 }} />}
                                                            onClick={() => setRcResetPassword(generateSecurePassword())}
                                                            sx={{ textTransform: 'none', fontSize: 11, fontWeight: 700, color: '#7c3aed', py: 0 }}
                                                        >
                                                            Generate Random
                                                        </Button>
                                                    </Box>
                                                    <TextField
                                                        fullWidth
                                                        type={rcShowPassword ? 'text' : 'password'}
                                                        placeholder="Enter new password (min 6 chars)"
                                                        value={rcResetPassword}
                                                        onChange={(e) => setRcResetPassword(e.target.value)}
                                                        helperText="Leave empty to keep existing password"
                                                        InputProps={{
                                                            startAdornment: (
                                                                <InputAdornment position="start">
                                                                    <LockIcon sx={{ color: '#7c3aed', fontSize: 20 }} />
                                                                </InputAdornment>
                                                            ),
                                                            endAdornment: (
                                                                <InputAdornment position="end">
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => setRcShowPassword(!rcShowPassword)}
                                                                        edge="end"
                                                                    >
                                                                        {rcShowPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                                                    </IconButton>
                                                                </InputAdornment>
                                                            ),
                                                        }}
                                                    />
                                                </Grid>
                                                <Grid size={{ xs: 12 }}>
                                                    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mt: 0.5 }}>
                                                        <Button
                                                            variant="contained"
                                                            size="small"
                                                            startIcon={<KeyIcon />}
                                                            onClick={handleQuickSaveCredentials}
                                                            disabled={remoteSaving}
                                                            sx={{ bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' }, fontWeight: 700, textTransform: 'none' }}
                                                        >
                                                            Save & Issue Credentials Now
                                                        </Button>
                                                        {rcEmail && (
                                                            <Button
                                                                variant="outlined"
                                                                size="small"
                                                                startIcon={copiedText ? <CheckIcon /> : <ContentCopyIcon />}
                                                                onClick={() => copyLoginDetailsToClipboard(rcName, rcEmail, rcResetPassword || undefined)}
                                                                sx={{ textTransform: 'none', fontWeight: 700, color: '#475569', borderColor: '#cbd5e1' }}
                                                            >
                                                                {copiedText ? 'Copied to Clipboard!' : 'Copy WhatsApp Login Details'}
                                                            </Button>
                                                        )}
                                                    </Box>
                                                </Grid>
                                            </Grid>
                                        </CardContent>
                                    </Card>

                                    {/* 3. Official Bank & Settlement */}
                                    <Card sx={{ mb: 3, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', borderTop: '4px solid #10b981' }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                <AccountBalanceIcon sx={{ color: '#059669' }} />
                                                <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b' }}>
                                                    Bank Account & UPI Settlement
                                                </Typography>
                                            </Box>
                                            <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                                                Printed on the vendor&apos;s customer quotations for direct payments.
                                            </Typography>

                                            <Grid container spacing={2}>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <TextField fullWidth label="Bank Name" value={rcBankName} onChange={(e) => setRcBankName(e.target.value)} />
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <TextField fullWidth label="Branch Name" value={rcBankBranch} onChange={(e) => setRcBankBranch(e.target.value)} />
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <TextField fullWidth label="Account Holder Name" value={rcAccountName} onChange={(e) => setRcAccountName(e.target.value)} />
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <TextField fullWidth label="Account Number" value={rcAccountNumber} onChange={(e) => setRcAccountNumber(e.target.value)} />
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <TextField fullWidth label="IFSC Code" value={rcIfsc} onChange={(e) => setRcIfsc(e.target.value.toUpperCase())} />
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <TextField fullWidth label="UPI ID / VPA" value={rcUpiId} onChange={(e) => setRcUpiId(e.target.value)} />
                                                </Grid>
                                            </Grid>
                                        </CardContent>
                                    </Card>
                                </Grid>

                                {/* Right Column: Brand Assets & Company Details */}
                                <Grid size={{ xs: 12, md: 6 }}>
                                    {/* Brand Visual Assets */}
                                    <Card sx={{ mb: 3, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', borderTop: '4px solid #ef4444' }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <VerifiedIcon sx={{ color: '#dc2626' }} />
                                                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b' }}>
                                                        Visual Brand Seals & Assets
                                                    </Typography>
                                                </Box>
                                                <Chip label="Cloud Stored" size="small" sx={{ bgcolor: '#fee2e2', color: '#dc2626', fontWeight: 700 }} />
                                            </Box>
                                            <Typography variant="body2" sx={{ color: '#64748b', mb: 2.5 }}>
                                                View what this vendor has uploaded or upload assets directly on their behalf.
                                            </Typography>

                                            <Grid container spacing={2}>
                                                {/* 1. Shop Logo */}
                                                <Grid size={{ xs: 12, sm: 12, md: 4 }}>
                                                    <Box sx={{ p: 2, borderRadius: 2, border: "1px dashed #cbd5e1", textAlign: "center", bgcolor: "#f8fafc", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                                                        <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5, color: "#1e293b" }}>
                                                            Shop Logo
                                                        </Typography>
                                                        <Box sx={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", mb: 1.5, bgcolor: "#fff", borderRadius: 1.5, p: 1, border: "1px solid #e2e8f0" }}>
                                                            <Box component="img" src={rcLogoUrl || "/logo.png"} alt="Logo" sx={{ maxHeight: 70, maxWidth: "100%", objectFit: "contain" }} onError={(e: any) => { e.target.src = "/logo.png"; }} />
                                                        </Box>
                                                        <input type="file" ref={rcLogoInputRef} accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleRemoteUpload(f, "logo"); }} />
                                                        <Button size="small" variant="outlined" startIcon={uploadingRcAsset === "logo" ? <CircularProgress size={14} /> : <CloudUploadIcon sx={{ fontSize: 14 }} />} onClick={() => rcLogoInputRef.current?.click()} disabled={!!uploadingRcAsset} sx={{ fontSize: 11, fontWeight: 700, textTransform: "none", py: 0.5 }}>
                                                            {uploadingRcAsset === "logo" ? "Uploading..." : "Replace Logo"}
                                                        </Button>
                                                    </Box>
                                                </Grid>

                                                {/* 2. Official Stamp & Signature (Single Unified Upload) */}
                                                <Grid size={{ xs: 12, sm: 12, md: 4 }}>
                                                    <Box sx={{ p: 2, borderRadius: 2, border: "1px dashed #cbd5e1", textAlign: "center", bgcolor: "#f8fafc", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                                                        <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5, color: "#1e293b" }}>
                                                            Official Stamp & Signature
                                                        </Typography>
                                                        <Box sx={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", mb: 1.5, bgcolor: "#fff", borderRadius: 1.5, p: 1, border: "1px solid #e2e8f0" }}>
                                                            <Box component="img" src={rcSignatureUrl || rcStampUrl || "/signature.png"} alt="Stamp & Signature" sx={{ maxHeight: 70, maxWidth: "100%", objectFit: "contain" }} onError={(e: any) => { e.target.src = "/signature.png"; }} />
                                                        </Box>
                                                        <input type="file" ref={rcSigInputRef} accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleRemoteUpload(f, "signature"); }} />
                                                        <Button size="small" variant="outlined" color="primary" startIcon={uploadingRcAsset === "signature" ? <CircularProgress size={14} /> : <CloudUploadIcon sx={{ fontSize: 14 }} />} onClick={() => rcSigInputRef.current?.click()} disabled={!!uploadingRcAsset} sx={{ fontSize: 11, fontWeight: 700, textTransform: "none", py: 0.5 }}>
                                                            {uploadingRcAsset === "signature" ? "Uploading..." : "Replace Stamp & Sig"}
                                                        </Button>
                                                    </Box>
                                                </Grid>

                                                {/* 3. Payment Barcode / QR */}
                                                <Grid size={{ xs: 12, sm: 12, md: 4 }}>
                                                    <Box sx={{ p: 2, borderRadius: 2, border: "1px dashed #cbd5e1", textAlign: "center", bgcolor: "#f8fafc", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                                                        <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5, color: "#1e293b" }}>
                                                            Payment Barcode / QR
                                                        </Typography>
                                                        <Box sx={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", mb: 1.5, bgcolor: "#fff", borderRadius: 1.5, p: 1, border: "1px solid #e2e8f0" }}>
                                                            {rcQrCodeUrl ? (
                                                                <Box component="img" src={rcQrCodeUrl} alt="QR" sx={{ maxHeight: 70, maxWidth: "100%", objectFit: "contain" }} />
                                                            ) : (
                                                                <Typography variant="caption" sx={{ color: "#94a3b8", fontStyle: "italic", fontSize: 11 }}>
                                                                    No Barcode Uploaded
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                        <input type="file" ref={rcQrInputRef} accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleRemoteUpload(f, "qr"); }} />
                                                        <Button size="small" variant="outlined" color="secondary" startIcon={uploadingRcAsset === "qr" ? <CircularProgress size={14} /> : <CloudUploadIcon sx={{ fontSize: 14 }} />} onClick={() => rcQrInputRef.current?.click()} disabled={!!uploadingRcAsset} sx={{ fontSize: 11, fontWeight: 700, textTransform: "none", py: 0.5 }}>
                                                            {uploadingRcAsset === "qr" ? "Uploading..." : "Upload / Replace QR"}
                                                        </Button>
                                                    </Box>
                                                </Grid>
                                            </Grid>
                                        </CardContent>
                                    </Card>

                                    {/* Company Identification & Addresses */}
                                    <Card sx={{ mb: 3, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', borderTop: '4px solid #0284c7' }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                <StorefrontIcon sx={{ color: '#0284c7' }} />
                                                <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b' }}>
                                                    Company Details & Legal Info
                                                </Typography>
                                            </Box>
                                            <Typography variant="body2" sx={{ color: '#64748b', mb: 2.5 }}>
                                                Identity details printed on every quotation header.
                                            </Typography>

                                            <Grid container spacing={2}>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <TextField fullWidth label="Shop / Company Name" value={rcName} onChange={(e) => setRcName(e.target.value)} required />
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <TextField fullWidth label="Authorized Signatory Name" value={rcSignatory} onChange={(e) => setRcSignatory(e.target.value)} />
                                                </Grid>
                                                <Grid size={{ xs: 12 }}>
                                                    <TextField fullWidth label="Company Tagline" value={rcTagline} onChange={(e) => setRcTagline(e.target.value)} />
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <TextField fullWidth label="Primary Phone" value={rcPhone} onChange={(e) => setRcPhone(e.target.value)} />
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <TextField fullWidth label="WhatsApp Phone" value={rcAlternatePhone} onChange={(e) => setRcAlternatePhone(e.target.value)} />
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <TextField fullWidth label="GSTIN Number" value={rcGstin} onChange={(e) => setRcGstin(e.target.value)} />
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <FormControl fullWidth>
                                                        <InputLabel sx={{ fontWeight: 700 }}>Operating Status</InputLabel>
                                                        <Select
                                                            value={rcStatus}
                                                            label="Operating Status"
                                                            onChange={(e) => setRcStatus(e.target.value as 'active' | 'suspended')}
                                                            sx={{ fontWeight: 700 }}
                                                        >
                                                            <MenuItem value="active" sx={{ color: '#16a34a', fontWeight: 700 }}>
                                                                🟢 Active (Operational)
                                                            </MenuItem>
                                                            <MenuItem value="suspended" sx={{ color: '#dc2626', fontWeight: 700 }}>
                                                                ⛔ Suspended (On Hold / Paused)
                                                            </MenuItem>
                                                        </Select>
                                                    </FormControl>
                                                </Grid>
                                                <Grid size={{ xs: 12 }}>
                                                    <TextField fullWidth label="Head Office Address" value={rcHeadOffice} onChange={(e) => setRcHeadOffice(e.target.value)} />
                                                </Grid>
                                                <Grid size={{ xs: 12 }}>
                                                    <TextField fullWidth label="Registered Office Address" value={rcRegisteredOffice} onChange={(e) => setRcRegisteredOffice(e.target.value)} />
                                                </Grid>
                                            </Grid>
                                        </CardContent>
                                    </Card>

                                    {/* Save Button Floating / Sticky at bottom */}
                                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mb: 4 }}>
                                        <Button
                                            variant="contained"
                                            size="large"
                                            startIcon={remoteSaving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : <SaveIcon />}
                                            onClick={handleSaveRemote}
                                            disabled={remoteSaving}
                                            sx={{
                                                bgcolor: '#2563eb',
                                                '&:hover': { bgcolor: '#1d4ed8' },
                                                fontWeight: 800,
                                                px: 4,
                                                py: 1.5,
                                                boxShadow: '0 8px 20px rgba(37,99,235,0.3)',
                                            }}
                                        >
                                            {remoteSaving ? 'Saving Changes...' : 'Save Changes to Vendor Workspace'}
                                        </Button>
                                    </Box>
                                </Grid>
                            </Grid>
                            </>
                        )}
                    </Box>

                {/* DEDICATED MANAGE LOGIN CREDENTIALS DIALOG */}
                <Dialog open={credentialsModalOpen} onClose={() => setCredentialsModalOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#faf5ff', borderBottom: '1px solid #f3e8ff' }}>
                        <KeyIcon sx={{ color: '#7c3aed' }} />
                        Customer Vendor Login Credentials — {credVendor?.name}
                    </DialogTitle>
                    <DialogContent sx={{ pt: 2.5 }}>
                        {credError && <Alert severity="error" sx={{ mb: 2 }}>{credError}</Alert>}
                        {credSuccess && <Alert severity="success" sx={{ mb: 2 }}>{credSuccess}</Alert>}

                        <Typography variant="body2" sx={{ color: '#64748b', mb: 2.5 }}>
                            Set or update the <strong>User ID (Login Email)</strong> and <strong>Password</strong> for this vendor. They can use these credentials to log in at <code>/login</code>.
                        </Typography>

                        <Stack spacing={2.5}>
                            <TextField
                                fullWidth
                                label="User ID / Login Email *"
                                type="email"
                                value={credEmail}
                                onChange={(e) => setCredEmail(e.target.value)}
                                placeholder="vendor@company.com"
                                helperText="Vendor will use this email address as their User ID to log in"
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <PersonIcon sx={{ color: '#7c3aed' }} />
                                        </InputAdornment>
                                    ),
                                }}
                            />

                            <Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                                        Password (Min 6 characters) *
                                    </Typography>
                                    <Button
                                        size="small"
                                        startIcon={<AutoAwesomeIcon sx={{ fontSize: 13 }} />}
                                        onClick={() => setCredPassword(generateSecurePassword())}
                                        sx={{ textTransform: 'none', fontSize: 11, fontWeight: 700, color: '#7c3aed', py: 0 }}
                                    >
                                        Generate Random Password
                                    </Button>
                                </Box>
                                <TextField
                                    fullWidth
                                    type={credShowPassword ? 'text' : 'password'}
                                    value={credPassword}
                                    onChange={(e) => setCredPassword(e.target.value)}
                                    placeholder="Enter new password"
                                    helperText="Min 6 characters. Share this password with the customer vendor."
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <LockIcon sx={{ color: '#7c3aed' }} />
                                            </InputAdornment>
                                        ),
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => setCredShowPassword(!credShowPassword)}
                                                    edge="end"
                                                >
                                                    {credShowPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Box>

                            <FormControl fullWidth size="small">
                                <InputLabel>Portal Role</InputLabel>
                                <Select
                                    value={credRole}
                                    label="Portal Role"
                                    onChange={(e) => setCredRole(e.target.value as any)}
                                >
                                    <MenuItem value="vendor">Vendor Admin (Full Shop Management, Custom Logo & Margins)</MenuItem>
                                    <MenuItem value="salesperson">Salesperson (Create Quotations Only)</MenuItem>
                                </Select>
                            </FormControl>

                            {credPassword && credEmail && (
                                <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                                    <Box>
                                        <Typography variant="caption" sx={{ fontWeight: 800, color: '#1e293b', display: 'block' }}>
                                            Ready to Share with Vendor:
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace' }}>
                                            User ID: {credEmail} | Password: {credPassword}
                                        </Typography>
                                    </Box>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={copiedText ? <CheckIcon sx={{ fontSize: 14 }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
                                        onClick={() => copyLoginDetailsToClipboard(credVendor?.name || 'Vendor', credEmail, credPassword)}
                                        sx={{ textTransform: 'none', fontSize: 11, fontWeight: 700, borderColor: '#7c3aed', color: '#7c3aed' }}
                                    >
                                        {copiedText ? 'Copied!' : 'Copy for WhatsApp'}
                                    </Button>
                                </Box>
                            )}
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ p: 2.5, bgcolor: '#f8fafc' }}>
                        <Button onClick={() => setCredentialsModalOpen(false)} sx={{ color: '#64748b' }}>Close</Button>
                        <Button
                            variant="contained"
                            onClick={handleSaveCredentialsModal}
                            disabled={credSaving}
                            startIcon={credSaving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <KeyIcon />}
                            sx={{ bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' }, fontWeight: 700 }}
                        >
                            {credSaving ? 'Saving...' : 'Save & Activate Login'}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* CREATE VENDOR DIALOG */}
                <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
                    <DialogTitle sx={{ fontWeight: 800 }}>
                        Register New Customer Vendor Account
                    </DialogTitle>
                    <DialogContent dividers>
                        {errorMsg && (
                            <Alert
                                severity="error"
                                sx={{ mb: 2 }}
                                action={
                                    (errorMsg.toLowerCase().includes('session') || errorMsg.toLowerCase().includes('sign in') || errorMsg.toLowerCase().includes('authentication')) ? (
                                        <Button
                                            color="inherit"
                                            size="small"
                                            variant="outlined"
                                            onClick={() => router.push('/login?redirect=/admin/vendors')}
                                            sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11 }}
                                        >
                                            Sign In Again
                                        </Button>
                                    ) : undefined
                                }
                            >
                                {errorMsg}
                            </Alert>
                        )}

                        <Grid container spacing={2} sx={{ mt: 0.5 }}>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth label="Company / Shop Name *" value={modalName} onChange={(e) => setModalName(e.target.value)} required />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth label="Authorized Signatory Name" value={modalSignatory} onChange={(e) => setModalSignatory(e.target.value)} placeholder="e.g. Authorized Signatory" />
                            </Grid>

                            {/* Multi-Tenant Node ID & Prefix Configuration */}
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField
                                    fullWidth
                                    label="Tenant Node ID (Optional)"
                                    value={modalNodeId}
                                    onChange={(e) => setModalNodeId(e.target.value.toUpperCase())}
                                    placeholder="e.g. NODE-VNS-002"
                                    helperText="Leave empty to auto-generate based on city & name"
                                    size="small"
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField
                                    fullWidth
                                    label="Quote Number Prefix (Optional)"
                                    value={modalQuotePrefix}
                                    onChange={(e) => setModalQuotePrefix(e.target.value.toUpperCase())}
                                    placeholder="e.g. KSS, SUN, APX"
                                    helperText="Prefix for sequential quotes (e.g. SUN-2026-0001)"
                                    size="small"
                                />
                            </Grid>

                            {/* Prominent Login Credentials Group */}
                            <Grid size={{ xs: 12 }}>
                                <Box sx={{ p: 2, bgcolor: '#f5f3ff', borderRadius: 2, border: '1px solid #ddd6fe' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <KeyIcon sx={{ color: '#7c3aed', fontSize: 20 }} />
                                            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#5b21b6' }}>
                                                Customer Vendor Login Credentials (User ID & Password)
                                            </Typography>
                                        </Box>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<AutoAwesomeIcon sx={{ fontSize: 13 }} />}
                                            onClick={() => setModalPassword(generateSecurePassword())}
                                            sx={{ textTransform: 'none', fontSize: 11, fontWeight: 700, color: '#7c3aed', borderColor: '#c4b5fd' }}
                                        >
                                            Generate Password
                                        </Button>
                                    </Box>
                                    <Grid container spacing={2}>
                                        <Grid size={{ xs: 12, sm: 6 }}>
                                            <TextField
                                                fullWidth
                                                label="User ID / Login Email *"
                                                type="email"
                                                value={modalEmail}
                                                onChange={(e) => setModalEmail(e.target.value)}
                                                placeholder="e.g. vendor@shop.com"
                                                helperText="Vendor will use this email address to log in"
                                                size="small"
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <PersonIcon sx={{ color: '#7c3aed', fontSize: 18 }} />
                                                        </InputAdornment>
                                                    ),
                                                }}
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 6 }}>
                                            <TextField
                                                fullWidth
                                                label="Vendor Password *"
                                                type={modalShowPassword ? 'text' : 'password'}
                                                value={modalPassword}
                                                onChange={(e) => setModalPassword(e.target.value)}
                                                placeholder="Min 6 characters"
                                                helperText="Password shared with vendor"
                                                size="small"
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <LockIcon sx={{ color: '#7c3aed', fontSize: 18 }} />
                                                        </InputAdornment>
                                                    ),
                                                    endAdornment: (
                                                        <InputAdornment position="end">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => setModalShowPassword(!modalShowPassword)}
                                                                edge="end"
                                                            >
                                                                {modalShowPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                                            </IconButton>
                                                        </InputAdornment>
                                                    ),
                                                }}
                                            />
                                        </Grid>
                                    </Grid>
                                </Box>
                            </Grid>

                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth label="Phone Number" value={modalPhone} onChange={(e) => setModalPhone(e.target.value)} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth label="GSTIN" value={modalGstin} onChange={(e) => setModalGstin(e.target.value)} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth type="number" label="Default Profit Margin (₹/kW)" value={modalDefaultMargin} onChange={(e) => setModalDefaultMargin(Number(e.target.value))} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth label="Head Office Address" value={modalHeadOffice} onChange={(e) => setModalHeadOffice(e.target.value)} />
                            </Grid>

                            <Grid size={{ xs: 12 }}>
                                <Divider sx={{ my: 1 }}>
                                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                                        BANK SETTLEMENT DETAILS
                                    </Typography>
                                </Divider>
                            </Grid>

                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth label="Bank Name" value={modalBankName} onChange={(e) => setModalBankName(e.target.value)} placeholder="HDFC Bank" />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth label="Account Holder" value={modalAccountName} onChange={(e) => setModalAccountName(e.target.value)} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth label="Account Number" value={modalAccountNumber} onChange={(e) => setModalAccountNumber(e.target.value)} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth label="IFSC Code" value={modalIfsc} onChange={(e) => setModalIfsc(e.target.value.toUpperCase())} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth label="UPI ID" value={modalUpiId} onChange={(e) => setModalUpiId(e.target.value)} />
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions sx={{ p: 2.5 }}>
                        <Button onClick={() => setDialogOpen(false)} sx={{ color: '#64748b' }}>Cancel</Button>
                        <Button variant="contained" onClick={handleCreateVendor} disabled={saving} sx={{ bgcolor: '#ff9800', '&:hover': { bgcolor: '#f57c00' }, fontWeight: 700 }}>
                            {saving ? 'Creating...' : 'Provision Vendor & Credentials'}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
}
