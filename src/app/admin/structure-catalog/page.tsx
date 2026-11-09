"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/apiFetch";
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
  TextField,
  InputAdornment,
  Chip,
  Button,
  IconButton,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Snackbar,
  Alert,
  Tooltip,
} from "@mui/material";
import {
  Search,
  ArrowBack,
  Add,
  CheckCircle,
  Edit,
  Delete,
  RestartAlt,
  Save,
  Close,
} from "@mui/icons-material";
import Link from "next/link";
import { ApolloProduct, apolloCategories } from "@/data/apolloProducts";

export default function AdminStructureCatalogPage() {
  const [catalog, setCatalog] = useState<ApolloProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Inline rate editing state
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [tempRateValue, setTempRateValue] = useState<string>("");

  // Inline GST editing state
  const [editingGstId, setEditingGstId] = useState<string | null>(null);
  const [tempGstValue, setTempGstValue] = useState<string>("18");

  // Dialog state for full product Add / Edit
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ApolloProduct | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "G.I. Solar Mounting Structure",
    unit: "Pcs",
    gstRate: 18,
    basePrice: 0,
    stock: "In Stock",
    description: "",
  });

  // Notification toast
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: "success" | "error" | "info" }>({
    open: false,
    message: "",
    severity: "success",
  });

  // Fetch catalog from API
  const fetchCatalog = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/structure-catalog");
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setCatalog(data.data);
      }
    } catch (err: any) {
      console.error("Failed to load structure catalog:", err);
      setToast({ open: true, message: "Failed to load catalog: " + err.message, severity: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  // Filtered products based on search and category
  const filteredProducts = useMemo(() => {
    return catalog.filter((product) => {
      const matchesCat =
        selectedCategory === "All" || product.category === selectedCategory;
      const query = search.toLowerCase();
      const matchesSearch =
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query) ||
        (product.description && product.description.toLowerCase().includes(query));
      return matchesCat && matchesSearch;
    });
  }, [catalog, search, selectedCategory]);

  const stats = useMemo(() => {
    return {
      total: catalog.length,
      structures: catalog.filter((p) => p.category === "G.I. Solar Mounting Structure").length,
      hardware: catalog.filter(
        (p) => p.category === "Clamps & Joiners" || p.category === "Fasteners & Hardware"
      ).length,
      electricals: catalog.filter(
        (p) =>
          p.category === "Wires & Cables" ||
          p.category === "Electrical Panels" ||
          p.category === "Earthing & Lightning"
      ).length,
    };
  }, [catalog]);

  // Open Dialog for Add or Edit
  const handleOpenDialog = (product?: ApolloProduct) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        sku: product.sku,
        category: product.category,
        unit: product.unit,
        gstRate: product.gstRate,
        basePrice: product.basePrice,
        stock: product.stock,
        description: product.description || "",
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: "",
        sku: "APL-",
        category: "G.I. Solar Mounting Structure",
        unit: "Pcs",
        gstRate: 18,
        basePrice: 0,
        stock: "In Stock",
        description: "",
      });
    }
    setDialogOpen(true);
  };

  // Save product (Add or Edit)
  const handleSaveProduct = async () => {
    if (!formData.name.trim() || !formData.sku.trim()) {
      setToast({ open: true, message: "Product name and SKU code are required", severity: "error" });
      return;
    }

    try {
      if (editingProduct) {
        // PUT update
        const res = await apiFetch("/api/structure-catalog", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingProduct.id,
            updates: {
              name: formData.name.trim(),
              sku: formData.sku.trim().toUpperCase(),
              category: formData.category,
              unit: formData.unit,
              gstRate: Number(formData.gstRate),
              basePrice: Number(formData.basePrice),
              stock: formData.stock,
              description: formData.description.trim(),
            },
          }),
        });
        const json = await res.json();
        if (json.success) {
          setToast({ open: true, message: `Updated "${formData.name}" successfully`, severity: "success" });
          setDialogOpen(false);
          fetchCatalog();
        } else {
          setToast({ open: true, message: json.message || "Failed to update", severity: "error" });
        }
      } else {
        // POST new
        const res = await apiFetch("/api/structure-catalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name.trim(),
            sku: formData.sku.trim().toUpperCase(),
            category: formData.category,
            unit: formData.unit,
            gstRate: Number(formData.gstRate),
            basePrice: Number(formData.basePrice),
            stock: formData.stock,
            description: formData.description.trim(),
          }),
        });
        const json = await res.json();
        if (json.success) {
          setToast({ open: true, message: `Added "${formData.name}" to catalog`, severity: "success" });
          setDialogOpen(false);
          fetchCatalog();
        } else {
          setToast({ open: true, message: json.message || "Failed to add", severity: "error" });
        }
      }
    } catch (err: any) {
      setToast({ open: true, message: "Error saving: " + err.message, severity: "error" });
    }
  };

  // Quick inline rate save
  const handleSaveInlineRate = async (product: ApolloProduct) => {
    const parsed = parseFloat(tempRateValue);
    if (isNaN(parsed) || parsed < 0) {
      setToast({ open: true, message: "Please enter a valid rate (₹)", severity: "error" });
      return;
    }

    try {
      const res = await apiFetch("/api/structure-catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: product.id,
          updates: { basePrice: parsed },
        }),
      });
      const json = await res.json();
      if (json.success) {
        setCatalog((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, basePrice: parsed } : p))
        );
        setToast({ open: true, message: `Updated rate for ${product.name} to ₹${parsed}`, severity: "success" });
        setEditingRateId(null);
      }
    } catch (err: any) {
      setToast({ open: true, message: "Failed to update rate: " + err.message, severity: "error" });
    }
  };

  // Save inline GST rate
  const handleSaveInlineGst = async (product: ApolloProduct, gstToSave?: number) => {
    const rate = gstToSave !== undefined ? gstToSave : parseFloat(tempGstValue);
    if (isNaN(rate) || rate < 0) {
      setToast({ open: true, message: "Please enter a valid GST %", severity: "error" });
      return;
    }

    try {
      const res = await apiFetch("/api/structure-catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: product.id,
          updates: { gstRate: rate },
        }),
      });
      const json = await res.json();
      if (json.success) {
        setCatalog((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, gstRate: rate } : p))
        );
        setToast({ open: true, message: `Updated GST for ${product.name} to ${rate}%`, severity: "success" });
        setEditingGstId(null);
      }
    } catch (err: any) {
      setToast({ open: true, message: "Failed to update GST: " + err.message, severity: "error" });
    }
  };

  // Delete product
  const handleDeleteProduct = async (product: ApolloProduct) => {
    if (!confirm(`Are you sure you want to delete "${product.name}" (${product.sku}) from the B2B catalog?`)) {
      return;
    }

    try {
      const res = await apiFetch(`/api/structure-catalog?id=${product.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        setCatalog((prev) => prev.filter((p) => p.id !== product.id));
        setToast({ open: true, message: `Deleted "${product.name}" from catalog`, severity: "info" });
      } else {
        setToast({ open: true, message: json.message || "Failed to delete", severity: "error" });
      }
    } catch (err: any) {
      setToast({ open: true, message: "Error deleting: " + err.message, severity: "error" });
    }
  };

  // Reset to default 41 catalog items
  const handleResetCatalog = async () => {
    if (
      !confirm(
        "Are you sure you want to reset the catalog to factory defaults? All custom changes will be restored to original rates."
      )
    ) {
      return;
    }

    try {
      const res = await apiFetch("/api/structure-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      const json = await res.json();
      if (json.success) {
        setCatalog(json.data);
        setToast({ open: true, message: "Catalog reset to default 41 items successfully", severity: "success" });
      }
    } catch (err: any) {
      setToast({ open: true, message: "Reset failed: " + err.message, severity: "error" });
    }
  };

  return (
    <Box sx={{ p: 3, bgcolor: "#f5f7fa", minHeight: "100vh" }}>
      <Box sx={{ maxWidth: 1250, mx: "auto" }}>
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Link href="/admin">
              <IconButton>
                <ArrowBack />
              </IconButton>
            </Link>
            <Box>
              <Typography variant="h4" fontWeight="bold" color="#1e293b">
                B2B Structure Catalog Manager
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Edit rates, add new components, and delete structure items for Apollo & Tata quotations
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<RestartAlt />}
              onClick={handleResetCatalog}
              sx={{ textTransform: "none", borderColor: "#cbd5e1" }}
              size="small"
            >
              Reset Defaults
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => handleOpenDialog()}
              sx={{
                bgcolor: "#2563eb",
                "&:hover": { bgcolor: "#1d4ed8" },
                fontWeight: "bold",
                textTransform: "none",
              }}
              size="small"
            >
              Add Component
            </Button>
            <Link href="/?tab=ApolloB2B" style={{ textDecoration: "none" }}>
              <Button
                variant="contained"
                sx={{
                  bgcolor: "#d97706",
                  "&:hover": { bgcolor: "#b45309" },
                  fontWeight: "bold",
                  textTransform: "none",
                }}
                size="small"
              >
                Go to Quotation Builder
              </Button>
            </Link>
          </Box>
        </Box>

        {/* Stats Grid */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 3 }}>
            <Card sx={{ borderRadius: 2, borderLeft: "4px solid #d97706" }}>
              <CardContent sx={{ py: 2 }}>
                <Typography variant="h4" fontWeight="bold" color="#d97706">
                  {stats.total}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Active Structure SKUs
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <Card sx={{ borderRadius: 2, borderLeft: "4px solid #2563eb" }}>
              <CardContent sx={{ py: 2 }}>
                <Typography variant="h4" fontWeight="bold" color="#2563eb">
                  {stats.structures}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Mounting Structure Sections
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <Card sx={{ borderRadius: 2, borderLeft: "4px solid #059669" }}>
              <CardContent sx={{ py: 2 }}>
                <Typography variant="h4" fontWeight="bold" color="#059669">
                  {stats.hardware}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Clamps, Fasteners & Joiners
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <Card sx={{ borderRadius: 2, borderLeft: "4px solid #7c3aed" }}>
              <CardContent sx={{ py: 2 }}>
                <Typography variant="h4" fontWeight="bold" color="#7c3aed">
                  {stats.electricals}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Wires, Panels & Earthing
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Search & Categories */}
        <Card sx={{ borderRadius: 2, mb: 3 }}>
          <CardContent sx={{ pb: "16px !important" }}>
            <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
              <TextField
                size="small"
                placeholder="Search by product name, SKU, or specs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
                sx={{ flex: 1, minWidth: 260 }}
              />
              <Typography variant="body2" color="text.secondary">
                Showing {filteredProducts.length} of {catalog.length} items
              </Typography>
            </Box>

            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
              {apolloCategories.map((cat) => (
                <Chip
                  key={cat}
                  label={cat}
                  clickable
                  color={selectedCategory === cat ? "warning" : "default"}
                  variant={selectedCategory === cat ? "filled" : "outlined"}
                  onClick={() => setSelectedCategory(cat)}
                  size="small"
                  sx={{
                    fontWeight: selectedCategory === cat ? "bold" : "normal",
                    fontSize: "0.75rem",
                  }}
                />
              ))}
            </Box>
          </CardContent>
        </Card>

        {/* Products Table */}
        <Card sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: 0 }}>
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#f8fafc" }}>
                      <TableCell sx={{ fontWeight: "bold" }}>Product Name</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>SKU Code</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>Category</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>Unit</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>GST %</TableCell>
                      <TableCell sx={{ fontWeight: "bold", width: 170 }}>Base Rate (₹)</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>Stock</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }} align="center">
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredProducts.map((p) => (
                      <TableRow key={p.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight="600" color="#1e293b">
                            {p.name}
                          </Typography>
                          {p.description && (
                            <Typography variant="caption" color="text.secondary">
                              {p.description}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={p.sku}
                            size="small"
                            sx={{
                              fontFamily: "monospace",
                              fontWeight: "bold",
                              bgcolor: "#f1f5f9",
                              color: "#475569",
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {p.category}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{p.unit}</Typography>
                        </TableCell>
                        {/* Editable GST % Cell */}
                        <TableCell>
                          {editingGstId === p.id ? (
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                              <Select
                                size="small"
                                value={tempGstValue}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setTempGstValue(String(val));
                                  handleSaveInlineGst(p, val);
                                }}
                                sx={{ height: 28, fontSize: "11px", minWidth: 70 }}
                              >
                                <MenuItem value="18" sx={{ fontSize: "11px" }}>18%</MenuItem>
                                <MenuItem value="5" sx={{ fontSize: "11px", color: "#059669", fontWeight: "bold" }}>5%</MenuItem>
                                <MenuItem value="12" sx={{ fontSize: "11px" }}>12%</MenuItem>
                                <MenuItem value="0" sx={{ fontSize: "11px" }}>0%</MenuItem>
                              </Select>
                              <IconButton
                                size="small"
                                color="default"
                                onClick={() => setEditingGstId(null)}
                                sx={{ p: 0.25 }}
                              >
                                <Close sx={{ fontSize: 13 }} />
                              </IconButton>
                            </Box>
                          ) : (
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5,
                                cursor: "pointer",
                                "&:hover .gst-edit-icon": { opacity: 1 },
                              }}
                              onClick={() => {
                                setEditingGstId(p.id);
                                setTempGstValue(String(p.gstRate ?? 18));
                              }}
                            >
                              <Chip
                                label={`${p.gstRate ?? 18}%`}
                                size="small"
                                color={p.gstRate === 5 ? "success" : p.gstRate === 18 ? "primary" : "default"}
                                variant="outlined"
                                sx={{ height: 22, fontSize: "0.75rem", fontWeight: "bold", cursor: "pointer" }}
                              />
                              <Tooltip title="Click to change GST (18% / 5%)">
                                <IconButton
                                  size="small"
                                  className="gst-edit-icon"
                                  sx={{ opacity: 0.3, p: 0.25 }}
                                >
                                  <Edit sx={{ fontSize: 13 }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          )}
                        </TableCell>

                        {/* Editable Rate Cell */}
                        <TableCell>
                          {editingRateId === p.id ? (
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                              <TextField
                                size="small"
                                type="number"
                                value={tempRateValue}
                                onChange={(e) => setTempRateValue(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveInlineRate(p);
                                  if (e.key === "Escape") setEditingRateId(null);
                                }}
                                InputProps={{
                                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                                }}
                                sx={{ width: 110 }}
                              />
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleSaveInlineRate(p)}
                              >
                                <Save fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="default"
                                onClick={() => setEditingRateId(null)}
                              >
                                <Close fontSize="small" />
                              </IconButton>
                            </Box>
                          ) : (
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                cursor: "pointer",
                                "&:hover .edit-icon": { opacity: 1 },
                              }}
                              onClick={() => {
                                setEditingRateId(p.id);
                                setTempRateValue(String(p.basePrice));
                              }}
                            >
                              <Typography
                                variant="body2"
                                fontWeight="700"
                                color={p.basePrice > 0 ? "#166534" : "#ea580c"}
                              >
                                {p.basePrice > 0 ? `₹${p.basePrice.toLocaleString("en-IN")}` : "₹0 (Custom)"}
                              </Typography>
                              <Tooltip title="Click to edit rate">
                                <IconButton
                                  size="small"
                                  className="edit-icon"
                                  sx={{ opacity: 0.4, p: 0.25 }}
                                >
                                  <Edit sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          )}
                        </TableCell>

                        {/* Stock */}
                        <TableCell>
                          <Chip
                            icon={<CheckCircle sx={{ fontSize: "14px !important" }} />}
                            label={p.stock}
                            size="small"
                            color={p.stock === "In Stock" ? "success" : "warning"}
                            variant="outlined"
                            sx={{ height: 22, fontSize: "0.7rem", fontWeight: "bold" }}
                          />
                        </TableCell>

                        {/* Actions (Edit Component, Delete Component) */}
                        <TableCell align="center">
                          <Box sx={{ display: "flex", justifyContent: "center", gap: 0.5 }}>
                            <Tooltip title="Edit Component Details">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleOpenDialog(p)}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Component">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteProduct(p)}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredProducts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                          <Typography color="text.secondary">
                            No products found matching &ldquo;{search}&rdquo;
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        {/* Add / Edit Product Dialog */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: "bold" }}>
            {editingProduct ? `Edit Component: ${editingProduct.name}` : "Add New Structure Component"}
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ pt: 1 }}>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Product / Component Name *"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Rafter 21ft 140X50"
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="SKU Code *"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="e.g. APL-RAF-21140"
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={formData.category}
                    label="Category"
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    {apolloCategories
                      .filter((c) => c !== "All")
                      .map((cat) => (
                        <MenuItem key={cat} value={cat}>
                          {cat}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  label="Base Price (₹)"
                  type="number"
                  value={formData.basePrice}
                  onChange={(e) => setFormData({ ...formData, basePrice: parseFloat(e.target.value) || 0 })}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                  }}
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  label="Unit"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="Pcs, Set, BDL, Mtr"
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  <TextField
                    fullWidth
                    label="GST %"
                    type="number"
                    value={formData.gstRate}
                    onChange={(e) => setFormData({ ...formData, gstRate: parseFloat(e.target.value) || 0 })}
                    size="small"
                  />
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    <Chip
                      label="18% (Std)"
                      size="small"
                      clickable
                      onClick={() => setFormData({ ...formData, gstRate: 18 })}
                      color={formData.gstRate === 18 ? "primary" : "default"}
                      variant={formData.gstRate === 18 ? "filled" : "outlined"}
                      sx={{ height: 20, fontSize: 9, cursor: "pointer" }}
                    />
                    <Chip
                      label="5% (Solar)"
                      size="small"
                      clickable
                      onClick={() => setFormData({ ...formData, gstRate: 5 })}
                      color={formData.gstRate === 5 ? "success" : "default"}
                      variant={formData.gstRate === 5 ? "filled" : "outlined"}
                      sx={{ height: 20, fontSize: 9, cursor: "pointer" }}
                    />
                  </Box>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Stock Status</InputLabel>
                  <Select
                    value={formData.stock}
                    label="Stock Status"
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  >
                    <MenuItem value="In Stock">In Stock</MenuItem>
                    <MenuItem value="Low Stock">Low Stock</MenuItem>
                    <MenuItem value="Made to Order">Made to Order</MenuItem>
                    <MenuItem value="Out of Stock">Out of Stock</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Description / Specs"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. 140x50mm Heavy Duty Structure Rafter"
                  size="small"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setDialogOpen(false)} color="inherit">
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveProduct}
              sx={{ bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8" } }}
            >
              {editingProduct ? "Save Changes" : "Add to Catalog"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Toast Notification */}
        <Snackbar
          open={toast.open}
          autoHideDuration={4000}
          onClose={() => setToast({ ...toast, open: false })}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            severity={toast.severity}
            onClose={() => setToast({ ...toast, open: false })}
            sx={{ width: "100%" }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  );
}
