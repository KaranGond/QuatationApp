"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/apiFetch";
import {
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    CircularProgress,
    Snackbar,
    Alert,
    InputAdornment,
} from "@mui/material";
import { Add, Edit, Delete, ArrowBack } from "@mui/icons-material";
import Link from "next/link";

type Product = {
    id: string;
    system_type_id: string | null;
    name: string;
    brand: string | null;
    capacity_kw: number | null;
    phase: number;
    base_price: number;
    gst_rate: number;
    is_active: boolean;
    created_at: string;
    system_types?: { name: string };
};

const systemTypes = [
    { id: "on-grid", name: "On-grid" },
    { id: "off-grid", name: "Off-grid" },
    { id: "hybrid", name: "Hybrid" },
    { id: "vfd-drive", name: "VFD/Drive" },
];

export default function ProductsAdminPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [notification, setNotification] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
        open: false,
        message: "",
        severity: "success",
    });

    const [formData, setFormData] = useState({
        system_type_id: "",
        name: "",
        brand: "",
        capacity_kw: 3,
        phase: 1,
        base_price: 180000,
        gst_rate: 8.9,
    });

    // Fetch products
    const fetchProducts = async () => {
        try {
            const res = await apiFetch("/api/products?active=all");
            const data = await res.json();
            if (data.success) {
                setProducts(data.data || []);
            }
        } catch (error) {
            console.error("Failed to fetch products:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    // Handle dialog open
    const handleOpenDialog = (product?: Product) => {
        if (product) {
            setEditingProduct(product);
            setFormData({
                system_type_id: product.system_type_id || "",
                name: product.name,
                brand: product.brand || "",
                capacity_kw: product.capacity_kw || 3,
                phase: product.phase,
                base_price: product.base_price,
                gst_rate: product.gst_rate,
            });
        } else {
            setEditingProduct(null);
            setFormData({
                system_type_id: "",
                name: "",
                brand: "",
                capacity_kw: 3,
                phase: 1,
                base_price: 180000,
                gst_rate: 8.9,
            });
        }
        setDialogOpen(true);
    };

    // Handle save
    const handleSave = async () => {
        try {
            const url = editingProduct ? `/api/products/${editingProduct.id}` : "/api/products";
            const method = editingProduct ? "PUT" : "POST";

            const res = await apiFetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const data = await res.json();
            if (data.success) {
                setNotification({ open: true, message: `Product ${editingProduct ? "updated" : "created"} successfully!`, severity: "success" });
                setDialogOpen(false);
                fetchProducts();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            setNotification({ open: true, message: (error as any).message, severity: "error" });
        }
    };

    // Handle delete
    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this product?")) return;

        try {
            const res = await apiFetch(`/api/products/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                setNotification({ open: true, message: "Product deleted successfully!", severity: "success" });
                fetchProducts();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            setNotification({ open: true, message: (error as any).message, severity: "error" });
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);
    };

    return (
        <Box sx={{ p: 3, bgcolor: "#f5f7fa", minHeight: "100vh" }}>
            <Box sx={{ maxWidth: 1200, mx: "auto" }}>
                {/* Header */}
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Link href="/admin">
                            <IconButton>
                                <ArrowBack />
                            </IconButton>
                        </Link>
                        <Typography variant="h4" fontWeight="bold">
                            Product Management
                        </Typography>
                    </Box>
                    <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenDialog()}>
                        Add Product
                    </Button>
                </Box>

                {/* Products Table */}
                <Card sx={{ borderRadius: 2 }}>
                    <CardContent>
                        {loading ? (
                            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                                <CircularProgress />
                            </Box>
                        ) : products.length === 0 ? (
                            <Box sx={{ textAlign: "center", p: 4 }}>
                                <Typography color="text.secondary">No products found. Add your first product!</Typography>
                            </Box>
                        ) : (
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                                            <TableCell sx={{ fontWeight: "bold" }}>Name</TableCell>
                                            <TableCell sx={{ fontWeight: "bold" }}>System Type</TableCell>
                                            <TableCell sx={{ fontWeight: "bold" }}>Brand</TableCell>
                                            <TableCell sx={{ fontWeight: "bold" }}>Capacity</TableCell>
                                            <TableCell sx={{ fontWeight: "bold" }}>Phase</TableCell>
                                            <TableCell sx={{ fontWeight: "bold" }}>Base Price</TableCell>
                                            <TableCell sx={{ fontWeight: "bold" }}>GST</TableCell>
                                            <TableCell sx={{ fontWeight: "bold" }} align="center">
                                                Actions
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {products.map((product) => (
                                            <TableRow key={product.id} hover>
                                                <TableCell>{product.name}</TableCell>
                                                <TableCell>
                                                    <Chip label={product.system_types?.name || "N/A"} size="small" />
                                                </TableCell>
                                                <TableCell>{product.brand || "-"}</TableCell>
                                                <TableCell>{product.capacity_kw} KW</TableCell>
                                                <TableCell>{product.phase}Ph</TableCell>
                                                <TableCell>{formatCurrency(product.base_price)}</TableCell>
                                                <TableCell>{product.gst_rate}%</TableCell>
                                                <TableCell align="center">
                                                    <IconButton size="small" onClick={() => handleOpenDialog(product)}>
                                                        <Edit fontSize="small" />
                                                    </IconButton>
                                                    <IconButton size="small" color="error" onClick={() => handleDelete(product.id)}>
                                                        <Delete fontSize="small" />
                                                    </IconButton>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </CardContent>
                </Card>
            </Box>

            {/* Add/Edit Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid size={{ xs: 12 }}>
                            <TextField
                                fullWidth
                                label="Product Name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., 3KW On-Grid Solar System"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <FormControl fullWidth>
                                <InputLabel>System Type</InputLabel>
                                <Select
                                    value={formData.system_type_id}
                                    label="System Type"
                                    onChange={(e) => setFormData({ ...formData, system_type_id: e.target.value })}
                                >
                                    {systemTypes.map((type) => (
                                        <MenuItem key={type.id} value={type.id}>
                                            {type.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                                fullWidth
                                label="Brand"
                                value={formData.brand}
                                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                placeholder="e.g., Waaree/Adani"
                            />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4 }}>
                            <TextField
                                fullWidth
                                label="Capacity (KW)"
                                type="number"
                                value={formData.capacity_kw}
                                onChange={(e) => setFormData({ ...formData, capacity_kw: parseFloat(e.target.value) || 0 })}
                            />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4 }}>
                            <FormControl fullWidth>
                                <InputLabel>Phase</InputLabel>
                                <Select
                                    value={formData.phase}
                                    label="Phase"
                                    onChange={(e) => setFormData({ ...formData, phase: Number(e.target.value) })}
                                >
                                    <MenuItem value={1}>Single Phase</MenuItem>
                                    <MenuItem value={3}>Three Phase</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <TextField
                                fullWidth
                                label="GST Rate (%)"
                                type="number"
                                value={formData.gst_rate}
                                onChange={(e) => setFormData({ ...formData, gst_rate: parseFloat(e.target.value) || 0 })}
                                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                            />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            <TextField
                                fullWidth
                                label="Base Price (Excl. GST)"
                                type="number"
                                value={formData.base_price}
                                onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })}
                                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSave}>
                        {editingProduct ? "Update" : "Create"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Notification */}
            <Snackbar
                open={notification.open}
                autoHideDuration={5000}
                onClose={() => setNotification({ ...notification, open: false })}
            >
                <Alert severity={notification.severity}>{notification.message}</Alert>
            </Snackbar>
        </Box>
    );
}
