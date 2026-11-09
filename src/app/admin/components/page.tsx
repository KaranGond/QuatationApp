"use client";

import { useState, useEffect, useCallback } from "react";
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
    Chip,
    CircularProgress,
    Snackbar,
    Alert,
    Switch,
    FormControlLabel,
} from "@mui/material";
import { Add, Edit, Delete, ArrowBack, Save, Restore } from "@mui/icons-material";
import Link from "next/link";
import { defaultComponents } from "@/lib/companyDetails";

type Component = {
    id?: string;
    system_type_id?: string | null;
    name: string;
    description: string;
    default_quantity: string;
    default_make: string;
    sort_order: number;
    is_default: boolean;
};

const systemTypes = [
    { id: "On-grid", name: "On-grid" },
    { id: "Off-grid", name: "Off-grid" },
    { id: "Hybrid", name: "Hybrid" },
    { id: "VFD/Drive", name: "VFD/Drive" },
];

export default function ComponentsAdminPage() {
    const [selectedSystemType, setSelectedSystemType] = useState("On-grid");
    const [components, setComponents] = useState<Component[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingComponent, setEditingComponent] = useState<Component | null>(null);
    const [editingIndex, setEditingIndex] = useState<number>(-1);
    const [notification, setNotification] = useState<{ open: boolean; message: string; severity: "success" | "error" | "warning" }>({
        open: false,
        message: "",
        severity: "success",
    });

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        default_quantity: "1 Nos",
        default_make: "Standard",
        is_default: true,
    });

    // Get hardcoded defaults for the selected system type
    const getHardcodedDefaults = useCallback((systemType: string): Component[] => {
        const defaults = defaultComponents[systemType as keyof typeof defaultComponents];
        if (!defaults) return [];
        return defaults.map((c: any, i: number) => ({
            name: c.name,
            description: c.description,
            default_quantity: c.quantity,
            default_make: c.make,
            sort_order: i,
            is_default: true,
        }));
    }, []);

    // Load components — try API first, then fall back to hardcoded defaults
    const fetchComponents = useCallback(async (systemType: string) => {
        setLoading(true);
        setHasUnsavedChanges(false);
        try {
            const res = await apiFetch(`/api/components?system_type=${encodeURIComponent(systemType)}`);
            const data = await res.json();
            if (data.success && data.data && data.data.length > 0 && !data.fromDefaults) {
                // We got components from DB
                setComponents(
                    data.data.map((c: any, i: number) => ({
                        id: c.id,
                        system_type_id: c.system_type_id,
                        name: c.name,
                        description: c.description || "",
                        default_quantity: c.default_quantity || c.quantity || "1 Nos",
                        default_make: c.default_make || c.make || "Standard",
                        sort_order: c.sort_order ?? i,
                        is_default: c.is_default ?? true,
                    }))
                );
            } else {
                // Fall back to hardcoded defaults
                setComponents(getHardcodedDefaults(systemType));
            }
        } catch {
            // On error, fall back to hardcoded defaults
            setComponents(getHardcodedDefaults(systemType));
        }
        setLoading(false);
    }, [getHardcodedDefaults]);

    useEffect(() => {
        fetchComponents(selectedSystemType);
    }, [selectedSystemType, fetchComponents]);

    // Handle dialog open
    const handleOpenDialog = (component?: Component, index?: number) => {
        if (component && typeof index === "number") {
            setEditingComponent(component);
            setEditingIndex(index);
            setFormData({
                name: component.name,
                description: component.description,
                default_quantity: component.default_quantity,
                default_make: component.default_make,
                is_default: component.is_default,
            });
        } else {
            setEditingComponent(null);
            setEditingIndex(-1);
            setFormData({
                name: "",
                description: "",
                default_quantity: "1 Nos",
                default_make: "Standard",
                is_default: true,
            });
        }
        setDialogOpen(true);
    };

    // Handle save (local edit)
    const handleSave = () => {
        if (!formData.name) {
            setNotification({ open: true, message: "Component name is required", severity: "error" });
            return;
        }

        if (editingIndex >= 0) {
            const updated = [...components];
            updated[editingIndex] = {
                ...components[editingIndex],
                ...formData,
            };
            setComponents(updated);
            setNotification({ open: true, message: "Component updated locally! Click 'Save All to Database' to persist.", severity: "warning" });
        } else {
            setComponents([
                ...components,
                {
                    ...formData,
                    sort_order: components.length,
                },
            ]);
            setNotification({ open: true, message: "Component added locally! Click 'Save All to Database' to persist.", severity: "warning" });
        }
        setHasUnsavedChanges(true);
        setDialogOpen(false);
    };

    // Handle delete (local)
    const handleDelete = (index: number) => {
        if (!confirm("Are you sure you want to delete this component?")) return;
        const updated = components.filter((_, i) => i !== index);
        setComponents(updated);
        setHasUnsavedChanges(true);
        setNotification({ open: true, message: "Component removed locally! Click 'Save All to Database' to persist.", severity: "warning" });
    };

    // Move component up/down
    const handleMove = (index: number, direction: "up" | "down") => {
        if (direction === "up" && index === 0) return;
        if (direction === "down" && index === components.length - 1) return;

        const updated = [...components];
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
        setComponents(updated);
        setHasUnsavedChanges(true);
    };

    // ========== SAVE ALL TO DATABASE ==========
    const handleSaveAllToDb = async () => {
        setSaving(true);
        try {
            // First, resolve the system_type_id for the selected system type
            const typeRes = await apiFetch(`/api/system-types`);
            const typeData = await typeRes.json();
            let systemTypeId: string | null = null;
            if (typeData.success && typeData.data) {
                const found = typeData.data.find((t: any) => t.name === selectedSystemType);
                if (found) systemTypeId = found.id;
            }

            // Delete existing components for this system type, then insert new ones
            // We'll use a batch approach via a custom endpoint
            const res = await apiFetch(`/api/components/batch`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    system_type: selectedSystemType,
                    system_type_id: systemTypeId,
                    components: components.map((c, i) => ({
                        name: c.name,
                        description: c.description,
                        default_quantity: c.default_quantity,
                        default_make: c.default_make,
                        sort_order: i,
                        is_default: c.is_default,
                    })),
                }),
            });

            const result = await res.json();
            if (result.success) {
                setHasUnsavedChanges(false);
                setNotification({ open: true, message: `✅ ${components.length} components saved to database for ${selectedSystemType}!`, severity: "success" });
                // Refresh to get DB IDs
                fetchComponents(selectedSystemType);
            } else {
                throw new Error(result.message || "Failed to save");
            }
        } catch (error) {
            setNotification({ open: true, message: `Failed to save: ${(error as any).message}`, severity: "error" });
        }
        setSaving(false);
    };

    // Reset to hardcoded defaults
    const handleResetToDefaults = () => {
        if (!confirm("Reset to hardcoded defaults? This will discard any changes. You'll need to Save to make it permanent.")) return;
        setComponents(getHardcodedDefaults(selectedSystemType));
        setHasUnsavedChanges(true);
        setNotification({ open: true, message: "Reset to defaults. Click 'Save All to Database' to persist.", severity: "warning" });
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
                            Component Management
                        </Typography>
                        {hasUnsavedChanges && (
                            <Chip label="Unsaved Changes" color="warning" size="small" sx={{ fontWeight: "bold" }} />
                        )}
                    </Box>
                    <Box sx={{ display: "flex", gap: 1 }}>
                        <Button
                            variant="outlined"
                            startIcon={<Restore />}
                            onClick={handleResetToDefaults}
                            color="warning"
                        >
                            Reset Defaults
                        </Button>
                        <Button variant="outlined" startIcon={<Add />} onClick={() => handleOpenDialog()}>
                            Add Component
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
                            onClick={handleSaveAllToDb}
                            disabled={saving}
                            color={hasUnsavedChanges ? "warning" : "primary"}
                            sx={{ fontWeight: "bold" }}
                        >
                            {saving ? "Saving..." : "Save All to Database"}
                        </Button>
                    </Box>
                </Box>

                {/* System Type Selector */}
                <Card sx={{ mb: 3, borderRadius: 2 }}>
                    <CardContent>
                        <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>
                            Select System Type
                        </Typography>
                        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                            {systemTypes.map((type) => (
                                <Chip
                                    key={type.id}
                                    label={type.name}
                                    onClick={() => {
                                        if (hasUnsavedChanges && !confirm("You have unsaved changes. Switch anyway?")) return;
                                        setSelectedSystemType(type.id);
                                    }}
                                    color={selectedSystemType === type.id ? "primary" : "default"}
                                    variant={selectedSystemType === type.id ? "filled" : "outlined"}
                                />
                            ))}
                        </Box>
                    </CardContent>
                </Card>

                {/* Components Table */}
                <Card sx={{ borderRadius: 2 }}>
                    <CardContent>
                        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                            Components for {selectedSystemType} System
                        </Typography>
                        {loading ? (
                            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                                <CircularProgress />
                            </Box>
                        ) : components.length === 0 ? (
                            <Box sx={{ textAlign: "center", p: 4 }}>
                                <Typography color="text.secondary">No components found. Add your first component!</Typography>
                            </Box>
                        ) : (
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                                            <TableCell sx={{ fontWeight: "bold", width: 50 }}>S.No</TableCell>
                                            <TableCell sx={{ fontWeight: "bold" }}>Component Name</TableCell>
                                            <TableCell sx={{ fontWeight: "bold" }}>Description / Specification</TableCell>
                                            <TableCell sx={{ fontWeight: "bold" }}>Quantity</TableCell>
                                            <TableCell sx={{ fontWeight: "bold" }}>Make / Brand</TableCell>
                                            <TableCell sx={{ fontWeight: "bold" }} align="center">
                                                Actions
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {components.map((component, index) => (
                                            <TableRow key={index} hover>
                                                <TableCell>{index + 1}</TableCell>
                                                <TableCell>
                                                    <Typography fontWeight="medium">{component.name}</Typography>
                                                </TableCell>
                                                <TableCell>{component.description}</TableCell>
                                                <TableCell>{component.default_quantity}</TableCell>
                                                <TableCell>{component.default_make}</TableCell>
                                                <TableCell align="center">
                                                    <IconButton size="small" onClick={() => handleMove(index, "up")} disabled={index === 0}>
                                                        ↑
                                                    </IconButton>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleMove(index, "down")}
                                                        disabled={index === components.length - 1}
                                                    >
                                                        ↓
                                                    </IconButton>
                                                    <IconButton size="small" onClick={() => handleOpenDialog(component, index)}>
                                                        <Edit fontSize="small" />
                                                    </IconButton>
                                                    <IconButton size="small" color="error" onClick={() => handleDelete(index)}>
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

                {/* Info */}
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2, textAlign: "center" }}>
                    Edit components above, then click &quot;Save All to Database&quot; to persist. Changes will reflect on the home page quotation builder.
                </Typography>
            </Box>

            {/* Add/Edit Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editingComponent ? "Edit Component" : "Add New Component"}</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid size={{ xs: 12 }}>
                            <TextField
                                fullWidth
                                label="Component Name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Solar Photovoltaic Modules"
                            />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            <TextField
                                fullWidth
                                label="Description / Specification"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="e.g., 580Wp (DCR) Topcon Modules"
                            />
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                            <TextField
                                fullWidth
                                label="Default Quantity"
                                value={formData.default_quantity}
                                onChange={(e) => setFormData({ ...formData, default_quantity: e.target.value })}
                                placeholder="e.g., 6 Nos"
                            />
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                            <TextField
                                fullWidth
                                label="Default Make / Brand"
                                value={formData.default_make}
                                onChange={(e) => setFormData({ ...formData, default_make: e.target.value })}
                                placeholder="e.g., Waaree/Adani"
                            />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={formData.is_default}
                                        onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                                    />
                                }
                                label="Include by default in new quotations"
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSave}>
                        {editingComponent ? "Update" : "Add"}
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
