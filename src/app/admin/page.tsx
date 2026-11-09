"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  CircularProgress,
  Chip,
} from "@mui/material";
import {
  Inventory,
  SettingsInputComponent,
  Receipt,
  Add,
  Inventory2,
  Storefront,
  ManageAccounts,
  Home,
  Build,
} from "@mui/icons-material";
import Link from "next/link";
import { companyDetails } from "@/lib/companyDetails";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/apiFetch";

type DashboardStats = {
  totalQuotations: number;
  draftQuotations: number;
  sentQuotations: number;
};

export default function AdminDashboard() {
  const { vendor, role } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalQuotations: 0,
    draftQuotations: 0,
    sentQuotations: 0,
  });
  const [loading, setLoading] = useState(true);

  const displayName = vendor?.name || companyDetails.name;
  const isDeveloper = role === "super_admin";

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await apiFetch("/api/quotations?limit=100");
        const data = await res.json();
        if (data.success) {
          const quotations = data.data || [];
          setStats({
            totalQuotations: quotations.length,
            draftQuotations: quotations.filter((q: any) => q.status === "draft").length,
            sentQuotations: quotations.filter((q: any) => q.status === "sent").length,
          });
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const menuItems = [
    {
      title: "Quotation Studio & Calculators",
      description: "Create Rooftop (On/Off/Hybrid), Apollo Structure B2B & Solar Service quotations",
      icon: <Add sx={{ fontSize: 40 }} />,
      color: "#16a34a",
      href: "/",
    },
    {
      title: "Saved Quotations",
      description: "View, edit, search, export & print customer quotations across all types",
      icon: <Receipt sx={{ fontSize: 40 }} />,
      color: "#9333ea",
      href: "/admin/quotations",
    },
    {
      title: "Bill of Materials (BOM)",
      description: "Customize components, makes & quantities for On-grid, Off-grid, Hybrid & VFD systems",
      icon: <SettingsInputComponent sx={{ fontSize: 40 }} />,
      color: "#f59e0b",
      href: "/admin/components",
    },
    {
      title: "Structure Catalog",
      description: "Browse & edit 41 Apollo/Tata mounting structures, clamps & cables",
      icon: <Inventory2 sx={{ fontSize: 40 }} />,
      color: "#2563eb",
      href: "/admin/structure-catalog",
    },
    {
      title: "Solar Products",
      description: "Manage rooftop panels, inverters & system package prices",
      icon: <Inventory sx={{ fontSize: 40 }} />,
      color: "#0891b2",
      href: "/admin/products",
    },
    {
      title: "Shop Settings & Brand Assets",
      description: "Manage custom logo, stamp seal, signature, UPI payment barcode & bank details",
      icon: <ManageAccounts sx={{ fontSize: 40 }} />,
      color: "#ea580c",
      href: "/vendor/profile",
    },
  ];

  // Add developer items if super admin
  if (isDeveloper) {
    menuItems.push({
      title: "Vendors & Live Remote Control",
      description: "Manage multi-tenant vendor accounts, Node IDs, passwords, banking & live on-call settings",
      icon: <Storefront sx={{ fontSize: 40 }} />,
      color: "#2563eb",
      href: "/admin/vendors",
    });
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: "#f5f7fa", minHeight: "100vh" }}>
      <Box sx={{ maxWidth: 1200, mx: "auto" }}>
        {/* Header */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4, flexWrap: "wrap", gap: 2 }}>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
              <Typography variant="h4" fontWeight="bold" color="#1a237e">
                {displayName}
              </Typography>
              {vendor?.node_id && (
                <Chip
                  label={vendor.node_id}
                  size="small"
                  sx={{ bgcolor: "#0f172a", color: "#fff", fontWeight: 700, fontSize: 11 }}
                />
              )}
              {isDeveloper && (
                <Chip
                  label="Master Admin"
                  size="small"
                  sx={{ bgcolor: "#ff9800", color: "#fff", fontWeight: 700, fontSize: 11 }}
                />
              )}
            </Box>
            <Typography variant="body2" color="text.secondary">
              Vendor Admin Dashboard · Configure components, catalogs, rates & shop brand assets
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
            <Link href="/?tab=Service" style={{ textDecoration: "none" }}>
              <Button variant="outlined" startIcon={<Build />} sx={{ borderColor: "#0284c7", color: "#0284c7", fontWeight: 700 }}>
                Service
              </Button>
            </Link>
            <Link href="/vendor/profile" style={{ textDecoration: "none" }}>
              <Button variant="outlined" startIcon={<ManageAccounts />} sx={{ borderColor: "#ff9800", color: "#ff9800", fontWeight: 700 }}>
                Shop Settings
              </Button>
            </Link>
            <Link href="/" style={{ textDecoration: "none" }}>
              <Button variant="contained" startIcon={<Home />} sx={{ bgcolor: "#1a237e", "&:hover": { bgcolor: "#0d1642" }, fontWeight: 700 }}>
                Quotation Builder
              </Button>
            </Link>
          </Box>
        </Box>

        {/* Stats Cards */}
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card sx={{ borderRadius: 2, borderLeft: "4px solid #4CAF50", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <CardContent>
                  <Typography variant="h3" fontWeight="bold" color="#4CAF50">
                    {stats.totalQuotations}
                  </Typography>
                  <Typography color="text.secondary" fontWeight={500}>Total Quotations</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card sx={{ borderRadius: 2, borderLeft: "4px solid #FF9800", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <CardContent>
                  <Typography variant="h3" fontWeight="bold" color="#FF9800">
                    {stats.draftQuotations}
                  </Typography>
                  <Typography color="text.secondary" fontWeight={500}>Draft Quotations</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card sx={{ borderRadius: 2, borderLeft: "4px solid #2196F3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <CardContent>
                  <Typography variant="h3" fontWeight="bold" color="#2196F3">
                    {stats.sentQuotations}
                  </Typography>
                  <Typography color="text.secondary" fontWeight={500}>Sent Quotations</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Menu Cards */}
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, color: "#1e293b" }}>
          Admin & Configuration Modules
        </Typography>
        <Grid container spacing={3}>
          {menuItems.map((item) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.title}>
              <Link href={item.href} style={{ textDecoration: "none" }}>
                <Card
                  sx={{
                    borderRadius: 2.5,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.2s ease-in-out",
                    border: "1px solid #e2e8f0",
                    "&:hover": { transform: "translateY(-4px)", boxShadow: "0 10px 25px rgba(0,0,0,0.1)", borderColor: item.color },
                  }}
                >
                  <CardContent sx={{ textAlign: "center", py: 3.5, px: 2.5 }}>
                    <Box sx={{ color: item.color, mb: 1.5 }}>{item.icon}</Box>
                    <Typography variant="h6" fontWeight="bold" sx={{ color: "#0f172a", fontSize: "1.05rem", mb: 0.8 }}>
                      {item.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.85rem", lineHeight: 1.5 }}>
                      {item.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Link>
            </Grid>
          ))}
        </Grid>

        {/* Company Info */}
        <Card sx={{ mt: 4, borderRadius: 2.5, border: "1px solid #e2e8f0" }}>
          <CardContent>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold" color="#1e293b">
                Company & Contact Information
              </Typography>
              <Link href="/vendor/profile" style={{ textDecoration: "none" }}>
                <Button size="small" sx={{ textTransform: "none", fontWeight: 700, color: "#2563eb" }}>
                  Edit in Shop Settings →
                </Button>
              </Link>
            </Box>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Business:</strong> {displayName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Signatory:</strong> {vendor?.authorized_signatory || companyDetails.authorizedSignatory}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>GSTIN:</strong> {vendor?.gstin || companyDetails.gstin || "Not specified"}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Phone:</strong> {vendor?.phone || companyDetails.phone}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Email:</strong> {vendor?.email || companyDetails.email}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Head Office:</strong> {vendor?.head_office || companyDetails.headOffice}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
