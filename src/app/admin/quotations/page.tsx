"use client";

import { useState, useEffect } from "react";
import {
    Box,
    Typography,
    Card,
    CardContent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Chip,
    CircularProgress,
    TextField,
    InputAdornment,
    Tooltip,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from "@mui/material";
import { ArrowBack, Visibility, Delete, Search, WhatsApp, Edit, Construction, Add, Storefront } from "@mui/icons-material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/apiFetch";

type Quotation = {
    id: string;
    quote_number: string | null;
    customer_name: string;
    customer_phone: string | null;
    capacity_kw: number | null;
    total_amount: number | null;
    status: string;
    created_at: string;
    pdf_url?: string;
    form_data?: any;
    components?: any;
    system_type_name?: string;
    vendor_id?: string | null;
};

export default function QuotationsAdminPage() {
    const { role, vendor: authVendor } = useAuth();
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [vendors, setVendors] = useState<any[]>([]);
    const [selectedVendorId, setSelectedVendorId] = useState<string>("all");
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [typeFilter, setTypeFilter] = useState<"all" | "b2b" | "rooftop" | "service">("all");
    const router = useRouter();

    useEffect(() => {
        if (authVendor?.id && role !== 'super_admin') {
            setSelectedVendorId(authVendor.id);
        }
    }, [authVendor, role]);

    const fetchQuotations = async () => {
        try {
            const [quoteRes, vendorRes] = await Promise.all([
                apiFetch("/api/quotations?limit=1000"),
                apiFetch("/api/vendors"),
            ]);
            const quoteData = await quoteRes.json();
            const vendorData = await vendorRes.json();

            if (quoteData.success) {
                setQuotations(quoteData.data || []);
            }
            if (vendorData.success) {
                setVendors(vendorData.data || []);
            }
        } catch (error) {
            console.error("Failed to fetch quotations:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuotations();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this quotation?")) return;

        try {
            const res = await apiFetch(`/api/quotations/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                fetchQuotations();
            }
        } catch (error) {
            console.error("Failed to delete quotation:", error);
        }
    };

    const handleEdit = (quotation: Quotation) => {
        // Navigate to home page with edit parameter
        router.push(`/?edit=${quotation.id}`);
    };

    const formatCurrency = (amount: number | null) => {
        if (amount === null) return "-";
        return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "draft":
                return "warning";
            case "saved":
                return "default";
            case "Printed":
                return "secondary";
            case "Emailed":
                return "info";
            case "WhatsApp Sent":
            case "sent":
                return "success";
            case "accepted":
                return "success";
            case "rejected":
            case "Failed Delivery":
                return "error";
            default:
                return "default";
        }
    };

    const isB2B = (q: Quotation) =>
        q.form_data?.selectedSystemType === "ApolloB2B" ||
        Boolean(q.form_data?.b2bItems) ||
        q.system_type_name === "ApolloB2B";

    const isService = (q: Quotation) =>
        q.form_data?.selectedSystemType === "Service" ||
        q.system_type_name === "Service";

    const filteredQuotations = quotations.filter((q) => {
        // Vendor filter (supports either vendor_id or tenant_id field)
        const quoteVendorId = q.vendor_id || (q as any).tenant_id;
        if (selectedVendorId !== "all" && quoteVendorId !== selectedVendorId) {
            return false;
        }

        // Type filter
        if (typeFilter === "b2b" && !isB2B(q)) return false;
        if (typeFilter === "service" && !isService(q)) return false;
        if (typeFilter === "rooftop" && (isB2B(q) || isService(q))) return false;

        // Search query filter (Name, Phone, Quote Number)
        const matchesSearch =
            q.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            q.quote_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            q.customer_phone?.includes(searchQuery);

        // Date filter
        const qDate = new Date(q.created_at).getTime();
        let matchesDate = true;
        if (startDate) {
            matchesDate = matchesDate && qDate >= new Date(startDate).getTime();
        }
        if (endDate) {
            // Add 1 day to end date to include the entire day
            const end = new Date(endDate);
            end.setDate(end.getDate() + 1);
            matchesDate = matchesDate && qDate <= end.getTime();
        }

        return matchesSearch && matchesDate;
    });

    return (
        <Box sx={{ p: 3, bgcolor: "#f5f7fa", minHeight: "100vh" }}>
            <Box sx={{ maxWidth: 1200, mx: "auto" }}>
                {/* Header */}
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Link href="/admin">
                            <IconButton>
                                <ArrowBack />
                            </IconButton>
                        </Link>
                        <Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <Typography variant="h4" fontWeight="bold" sx={{ color: "#0f172a" }}>
                                    {role === "super_admin" ? "Global Quotations" : "Saved Quotations"}
                                </Typography>
                                {role === "super_admin" && (
                                    <Chip label="Layer 1 Control" size="small" sx={{ bgcolor: "#0f172a", color: "#fff", fontWeight: 700 }} />
                                )}
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                                {role === "super_admin"
                                    ? "Monitor and manage quotation output across all registered vendors"
                                    : "View, search, edit, download and share customer quotations"}
                            </Typography>
                        </Box>
                    </Box>
                    <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
                        {role === "super_admin" ? (
                            <FormControl size="small" sx={{ minWidth: 200 }}>
                                <InputLabel>Filter by Vendor</InputLabel>
                                <Select
                                    value={selectedVendorId}
                                    label="Filter by Vendor"
                                    onChange={(e) => setSelectedVendorId(e.target.value)}
                                >
                                    <MenuItem value="all">🏢 All Vendors ({quotations.length})</MenuItem>
                                    {vendors.map((v) => (
                                        <MenuItem key={v.id} value={v.id}>
                                            {v.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        ) : (
                            <Chip
                                icon={<Storefront sx={{ fontSize: "16px !important", color: "#1d4ed8 !important" }} />}
                                label={authVendor?.name || "My Quotations"}
                                sx={{ bgcolor: "#eff6ff", color: "#1d4ed8", fontWeight: 700, px: 1, height: 36 }}
                            />
                        )}
                        <Link href="/?tab=ApolloB2B" style={{ textDecoration: "none" }}>
                            <Button
                                variant="contained"
                                size="small"
                                startIcon={<Construction />}
                                sx={{ bgcolor: "#d97706", "&:hover": { bgcolor: "#b45309" }, textTransform: "none", fontWeight: "bold" }}
                            >
                                New B2B Quote
                            </Button>
                        </Link>
                        <Link href="/" style={{ textDecoration: "none" }}>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<Add />}
                                sx={{ textTransform: "none", fontWeight: "bold" }}
                            >
                                New Rooftop Quote
                            </Button>
                        </Link>
                        <TextField
                            size="small"
                            type="date"
                            label="Start Date"
                            InputLabelProps={{ shrink: true }}
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <TextField
                            size="small"
                            type="date"
                            label="End Date"
                            InputLabelProps={{ shrink: true }}
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                        <TextField
                            size="small"
                            placeholder="Search name, phone..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{ width: 220 }}
                        />
                    </Box>
                </Box>

                {/* Type Filter Chips */}
                <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 2, flexWrap: "wrap" }}>
                    <Typography variant="body2" sx={{ fontWeight: "bold", color: "text.secondary", mr: 1 }}>Filter Type:</Typography>
                    <Chip
                        label={`All (${quotations.length})`}
                        clickable
                        color={typeFilter === "all" ? "primary" : "default"}
                        variant={typeFilter === "all" ? "filled" : "outlined"}
                        onClick={() => setTypeFilter("all")}
                        size="small"
                    />
                    <Chip
                        icon={<Construction sx={{ fontSize: "14px !important" }} />}
                        label={`Structure B2B (${quotations.filter(isB2B).length})`}
                        clickable
                        color={typeFilter === "b2b" ? "warning" : "default"}
                        variant={typeFilter === "b2b" ? "filled" : "outlined"}
                        onClick={() => setTypeFilter("b2b")}
                        size="small"
                    />
                    <Chip
                        label={`Rooftop Solar (${quotations.filter((q) => !isB2B(q) && !isService(q)).length})`}
                        clickable
                        color={typeFilter === "rooftop" ? "success" : "default"}
                        variant={typeFilter === "rooftop" ? "filled" : "outlined"}
                        onClick={() => setTypeFilter("rooftop")}
                        size="small"
                    />
                    <Chip
                        label={`Service Proposals (${quotations.filter(isService).length})`}
                        clickable
                        color={typeFilter === "service" ? "secondary" : "default"}
                        variant={typeFilter === "service" ? "filled" : "outlined"}
                        onClick={() => setTypeFilter("service")}
                        size="small"
                    />
                </Box>

                {/* Status Legend */}
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 3, alignItems: "center", bgcolor: "white", p: 2, borderRadius: 2, border: "1px solid #e2e8f0" }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mr: 1, fontWeight: "bold" }}>Status Guide:</Typography>
                    <Chip label="Draft" size="small" color="warning" />
                    <Typography variant="caption" color="text.secondary" sx={{ mr: 2 }}>Not saved</Typography>
                    
                    <Chip label="Saved" size="small" color="default" />
                    <Typography variant="caption" color="text.secondary" sx={{ mr: 2 }}>Only saved</Typography>
                    
                    <Chip label="Printed" size="small" color="secondary" />
                    <Typography variant="caption" color="text.secondary" sx={{ mr: 2 }}>Printed to PDF</Typography>
                    
                    <Chip label="Emailed" size="small" color="info" />
                    <Typography variant="caption" color="text.secondary" sx={{ mr: 2 }}>Sent via Email</Typography>
                    
                    <Chip label="WhatsApp Sent" size="small" color="success" />
                    <Typography variant="caption" color="text.secondary">Sent via WhatsApp</Typography>
                </Box>

                {/* Quotations Table */}
                <Card sx={{ borderRadius: 2 }}>
                    <CardContent>
                        {loading ? (
                            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                                <CircularProgress />
                            </Box>
                        ) : filteredQuotations.length === 0 ? (
                            <Box sx={{ textAlign: "center", p: 4 }}>
                                <Typography color="text.secondary">
                                    {searchQuery ? "No quotations match your search." : "No quotations found."}
                                </Typography>
                            </Box>
                        ) : (
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                                            <TableCell sx={{ fontWeight: "bold" }}>Quote No.</TableCell>
                                            <TableCell sx={{ fontWeight: "bold" }}>Vendor / Shop</TableCell>
                                            <TableCell sx={{ fontWeight: "bold" }}>Customer</TableCell>
                                            <TableCell sx={{ fontWeight: "bold" }}>Phone</TableCell>
                                            <TableCell sx={{ fontWeight: "bold" }}>System / Capacity</TableCell>
                                            <TableCell sx={{ fontWeight: "bold" }}>Amount</TableCell>
                                            <TableCell sx={{ fontWeight: "bold" }}>Status</TableCell>
                                            <TableCell sx={{ fontWeight: "bold" }}>Date</TableCell>
                                            <TableCell sx={{ fontWeight: "bold" }} align="center">
                                                Actions
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredQuotations.map((quotation) => (
                                            <TableRow key={quotation.id} hover>
                                                <TableCell>
                                                    <Typography variant="body2" fontWeight="medium">
                                                        {quotation.quote_number || "-"}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    {(() => {
                                                        const v = vendors.find((vend) => vend.id === quotation.vendor_id);
                                                        const displayName = v ? v.name : (quotation.vendor_id ? quotation.vendor_id : "Standard / Direct");
                                                        return (
                                                            <Chip
                                                                icon={<Storefront sx={{ fontSize: "14px !important" }} />}
                                                                label={displayName}
                                                                size="small"
                                                                sx={{
                                                                    bgcolor: '#f1f5f9',
                                                                    color: '#334155',
                                                                    fontWeight: 700,
                                                                    fontSize: '0.72rem',
                                                                    border: '1px solid rgba(0,0,0,0.08)'
                                                                }}
                                                            />
                                                        );
                                                    })()}
                                                </TableCell>
                                                <TableCell>{quotation.customer_name}</TableCell>
                                                <TableCell>{quotation.customer_phone || "-"}</TableCell>
                                                <TableCell>
                                                    {isB2B(quotation) ? (
                                                        <Chip
                                                            icon={<Construction sx={{ fontSize: "14px !important" }} />}
                                                            label={`Structure B2B (${quotation.form_data?.b2bItems?.length || (Array.isArray(quotation.components) ? quotation.components.length : 0)} items)`}
                                                            size="small"
                                                            sx={{ bgcolor: "#fef3c7", color: "#92400e", fontWeight: "bold", fontSize: "0.72rem" }}
                                                        />
                                                    ) : isService(quotation) ? (
                                                        <Chip
                                                            label="Service"
                                                            size="small"
                                                            sx={{ bgcolor: "#e0e7ff", color: "#3730a3", fontWeight: "bold", fontSize: "0.72rem" }}
                                                        />
                                                    ) : quotation.capacity_kw ? (
                                                        `${quotation.capacity_kw} KW`
                                                    ) : (
                                                        "-"
                                                    )}
                                                </TableCell>
                                                <TableCell>{formatCurrency(quotation.total_amount)}</TableCell>
                                                <TableCell>
                                                    <Chip label={quotation.status} size="small" color={getStatusColor(quotation.status) as any} />
                                                </TableCell>
                                                <TableCell>{formatDate(quotation.created_at)}</TableCell>
                                                <TableCell align="center">
                                                    <Tooltip title="Edit & Re-send">
                                                        <IconButton size="small" color="primary" onClick={() => handleEdit(quotation)}>
                                                            <Edit fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title={quotation.pdf_url ? "View PDF" : "PDF not yet generated (Click to open & generate)"}>
                                                        <IconButton 
                                                            size="small" 
                                                            onClick={() => {
                                                                if (quotation.pdf_url) {
                                                                    window.open(quotation.pdf_url, '_blank');
                                                                } else {
                                                                    handleEdit(quotation);
                                                                }
                                                            }}
                                                        >
                                                            <Visibility fontSize="small" color={quotation.pdf_url ? "primary" : "action"} />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Send via WhatsApp">
                                                        <IconButton size="small" color="success">
                                                            <WhatsApp fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Delete">
                                                        <IconButton size="small" color="error" onClick={() => handleDelete(quotation.id)}>
                                                            <Delete fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </CardContent>
                </Card>

                {/* Summary */}
                <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        Showing {filteredQuotations.length} of {quotations.length} quotations
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
}
