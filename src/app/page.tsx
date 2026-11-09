"use client";

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Tooltip,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import {
  Add,
  Delete,
  Edit,
  Print,
  RestartAlt,
  SolarPower,
  BatteryChargingFull,
  SettingsInputComponent,
  Water,
  AdminPanelSettings,
  ExpandMore,
  Person,
  Settings,
  AttachMoney,
  ListAlt,
  WhatsApp,
  Email,
  AddCircle,
  CleaningServices,
  Construction,
  Search as SearchIcon,
  Verified,
  Factory,
  Storefront,
  Logout,
  Login as LoginIcon,
  ContentCopy,
  Launch,
  Check,
} from "@mui/icons-material";
import { useAuth } from "@/context/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import { apiFetch } from "@/lib/apiFetch";
import {
  buildQuoteWhatsAppMessage,
  openWhatsAppDirect,
  formatWhatsAppPhoneNumber,
} from "@/lib/whatsappShare";
import { useReactToPrint } from "react-to-print";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  companies,
  defaultTerms,
  defaultComponents,
  gstConfig,
  defaultSubsidy,
  getSubsidyForCapacity,
  calculateSavings,
  generateQuoteNumber,
  defaultServiceItems,
  defaultServiceTerms,
  serviceGstRate,
  generateServiceRefNumber,
} from "@/lib/companyDetails";
import type { ServiceItem } from "@/lib/companyDetails";
import type { QuotationComponent } from "@/types";
import {
  apolloCategories,
  apolloProductsCatalog,
  defaultB2BTerms,
  numberToWordsINR,
} from "@/data/apolloProducts";
import type { ApolloProduct, ApolloLineItem } from "@/data/apolloProducts";

// System type configuration
const systemTypes = [
  { id: "On-grid", name: "On-grid", icon: <SolarPower fontSize="small" />, color: "#4CAF50" },
  { id: "Off-grid", name: "Off-grid", icon: <BatteryChargingFull fontSize="small" />, color: "#FF9800" },
  { id: "Hybrid", name: "Hybrid", icon: <SettingsInputComponent fontSize="small" />, color: "#2196F3" },
  { id: "VFD/Drive", name: "VFD/Drive", icon: <Water fontSize="small" />, color: "#9C27B0" },
  { id: "Service", name: "Service/O&M", icon: <CleaningServices fontSize="small" />, color: "#0d47a1" },
  { id: "ApolloB2B", name: "Structure / B2B", icon: <Construction fontSize="small" />, color: "#d97706" },
];

// Panel types
const panelTypes = [
  { value: "Monoperc", label: "Monoperc" },
  { value: "Bifacial", label: "Bifacial" },
  { value: "Topcon", label: "Topcon" },
  { value: "Topcon Bifacial", label: "Topcon Bifacial" },
  { value: "HJT", label: "HJT" },
  { value: "DCR", label: "DCR" },
  { value: "NDCR", label: "NDCR" },
];

// Solar panel brands
const panelBrands = ["Adani", "Tata", "Waaree", "Reliance", "Premier", "Emvee", "Vikram Solar", "Goldi Solar", "RenewSys", "Jakson", "Longi", "Jinko", "Canadian Solar", "Other"];

// Inverter brands
const inverterBrands = ["Polycab", "Shakti", "Growatt", "Sungrow", "Huawei", "Deye", "Servotech", "Luminous", "GoodWe", "Solis", "Solax", "Sofar Solar", "Other"];

// Wrapper with Suspense for useSearchParams
export default function QuotationBuilderPage() {
  return (
    <AuthGuard>
      <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Typography>Loading...</Typography></Box>}>
        <QuotationBuilder />
      </Suspense>
    </AuthGuard>
  );
}

function QuotationBuilder() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get('edit');
  const tabParam = searchParams.get('tab');

  // Edit Mode State
  const [editingQuotationId, setEditingQuotationId] = useState<string | null>(null);
  const [editLoaded, setEditLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Multi-vendor Authentication & Tenant Context
  const { user, vendor, role, signOut, allVendors, switchVendor } = useAuth();

  // Company Selection & Multi-Vendor Tenant Resolution
  const resolveVendorId = useCallback((id: string, list: any[]) => {
    if (!id) return '';
    if (list.some(v => v.id === id)) return id;
    const match = list.find(v =>
      v.slug === id ||
      v.id === id ||
      (id && v.name && v.name.toLowerCase().includes(id.toLowerCase()))
    );
    return match ? match.id : '';
  }, []);

  const [selectedCompanyId, setSelectedCompanyId] = useState(companies[0].id);

  // Effective ID guaranteed to match the exact vendor for the logged-in user
  const effectiveCompanyId = useMemo(() => {
    // 1. Regular vendors are strictly locked to their own assigned company
    if (role !== 'super_admin' && vendor?.id) {
      return vendor.id;
    }

    // 2. Super admins can choose or simulate any vendor from the list
    if (allVendors && allVendors.length > 0) {
      const resolved = resolveVendorId(selectedCompanyId, allVendors);
      if (resolved) return resolved;
      if (vendor?.id && allVendors.some(v => v.id === vendor.id)) return vendor.id;
      return allVendors[0].id;
    }

    // Fallback before allVendors loads
    if (vendor?.id) return vendor.id;
    if (companies.some(c => c.id === selectedCompanyId)) return selectedCompanyId;
    return companies[0]?.id || '';
  }, [role, vendor, allVendors, selectedCompanyId, resolveVendorId]);

  // Keep selectedCompanyId in sync with effectiveCompanyId
  useEffect(() => {
    if (effectiveCompanyId && selectedCompanyId !== effectiveCompanyId) {
      setSelectedCompanyId(effectiveCompanyId);
    }
  }, [effectiveCompanyId, selectedCompanyId]);

  // Sync selectedCompanyId when vendor context changes
  useEffect(() => {
    if (vendor?.id && (role !== 'super_admin' || !selectedCompanyId || selectedCompanyId === companies[0].id)) {
      setSelectedCompanyId(vendor.id);
    }
  }, [vendor, role, selectedCompanyId]);

  const activeCompany = useMemo(() => {
    const targetId = (role !== 'super_admin' && vendor?.id)
      ? vendor.id
      : (effectiveCompanyId || selectedCompanyId);

    // Prefer the active vendor from AuthContext if ID matches, else find in allVendors
    const foundVendor = (vendor && vendor.id === targetId ? vendor : null) || 
                        allVendors.find(v => v.id === targetId);

    if (foundVendor) {
      const isDemoKaran = foundVendor.id === 'a0000000-0000-0000-0000-000000000001' || foundVendor.slug === 'karan-solar';
      const vLogo = foundVendor.logo_url && foundVendor.logo_url !== '/logo.png' 
        ? foundVendor.logo_url 
        : (isDemoKaran ? '/logo.png' : '');
      const vSig = foundVendor.signature_url && foundVendor.signature_url !== '/signature.png' 
        ? foundVendor.signature_url 
        : (foundVendor.stamp_url && foundVendor.stamp_url !== '/stamp.png' 
            ? foundVendor.stamp_url 
            : (isDemoKaran ? '/signature.png' : ''));
      const vStamp = foundVendor.stamp_url && foundVendor.stamp_url !== '/stamp.png' 
        ? foundVendor.stamp_url 
        : (vSig || null);
      const vQr = foundVendor.qr_code_url && foundVendor.qr_code_url !== '/payment.png'
        ? foundVendor.qr_code_url
        : (isDemoKaran ? '/payment.png' : null);

      return {
        id: foundVendor.id,
        name: foundVendor.name,
        tagline: foundVendor.tagline || "ILLUMINATING YOUR FUTURE WITH CLEAN ENERGY",
        gstin: foundVendor.gstin || "",
        headOffice: foundVendor.head_office || "",
        registeredOffice: foundVendor.registered_office || "",
        phone: foundVendor.phone || "",
        alternatePhone: foundVendor.alternate_phone || "",
        email: foundVendor.email || "",
        bank: {
          name: foundVendor.bank_name || "Bank",
          branch: foundVendor.bank_branch || "",
          accountName: foundVendor.account_name || foundVendor.name,
          accountNumber: foundVendor.account_number || "",
          ifsc: foundVendor.ifsc || "",
          upiId: foundVendor.upi_id || "",
        },
        logo: vLogo,
        logo_url: vLogo,
        signature: vSig,
        signature_url: vSig,
        stamp: vStamp,
        stamp_url: vStamp,
        qr_code_url: vQr,
        authorizedSignatory: foundVendor.authorized_signatory || "Authorized Signatory",
        authorized_signatory: foundVendor.authorized_signatory || "Authorized Signatory",
        defaultMargin: foundVendor.default_margin || 0,
        componentsSettings: foundVendor.components_settings || {},
      };
    }
    return companies.find(c => c.id === targetId || (targetId === 'arpit' && c.id === 'a0000000-0000-0000-0000-000000000001')) || companies[0];
  }, [role, vendor, effectiveCompanyId, selectedCompanyId, allVendors]);

  // Sync vendor component defaults when vendor/company changes
  useEffect(() => {
    const targetId = effectiveCompanyId || selectedCompanyId;
    const foundVendor = allVendors.find(v => v.id === targetId) || (vendor && vendor.id === targetId ? vendor : null);
    if (foundVendor?.components_settings) {
      const cs = foundVendor.components_settings;
      if (cs.preferredPanelBrand) setPanelBrand(cs.preferredPanelBrand);
      if (cs.preferredInverterBrand) setInverterBrand(cs.preferredInverterBrand);
      if (cs.preferredStructureMake) setB2bStructureMake(cs.preferredStructureMake);
    }
  }, [effectiveCompanyId, selectedCompanyId, allVendors, vendor]);

  // Customer Details
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  // System Configuration
  const [selectedSystemType, setSelectedSystemType] = useState(
    tabParam === "ApolloB2B" || tabParam === "b2b" || tabParam === "structure"
      ? "ApolloB2B"
      : tabParam === "Service" || tabParam === "service"
      ? "Service"
      : "On-grid"
  );

  useEffect(() => {
    if (tabParam === "Service" || tabParam === "service") {
      setSelectedSystemType("Service");
    } else if (tabParam === "ApolloB2B" || tabParam === "b2b" || tabParam === "structure") {
      setSelectedSystemType("ApolloB2B");
    }
  }, [tabParam]);
  const [capacityKw, setCapacityKw] = useState<number>(3);
  const [phase, setPhase] = useState<number>(1);

  // Panel Configuration
  const [panelWattage, setPanelWattage] = useState<number>(620);
  const [panelBrand, setPanelBrand] = useState("Adani");
  const [customPanelBrand, setCustomPanelBrand] = useState("");
  const [panelType, setPanelType] = useState("Monoperc");
  const [panelWarranty, setPanelWarranty] = useState("25 Years"); // New Warranty State
  const effectivePanelBrand = panelBrand === "Other" ? customPanelBrand : panelBrand;

  // Inverter Configuration
  const [inverterBrand, setInverterBrand] = useState("Polycab");
  const [customInverterBrand, setCustomInverterBrand] = useState("");
  const [inverterModel, setInverterModel] = useState("3 KW On-Grid String");
  const [inverterWarranty, setInverterWarranty] = useState("5 Years"); // New Warranty State
  const [batteryWarranty, setBatteryWarranty] = useState("5 Years"); // Battery Warranty State
  const [customBatteryWarranty, setCustomBatteryWarranty] = useState(""); // Custom Battery Warranty
  const effectiveBatteryWarranty = batteryWarranty === "Other" ? customBatteryWarranty : batteryWarranty;
  const [inverterModelEdited, setInverterModelEdited] = useState(false); // Track if user manually edited inverter model
  const effectiveInverterBrand = inverterBrand === "Other" ? customInverterBrand : inverterBrand;

  // Pricing
  const [priceInput, setPriceInput] = useState<number>(180000); // Now represents Price Included GST
  const [gstRate, setGstRate] = useState<number>(gstConfig.compositeRate);
  const [centralSubsidy, setCentralSubsidy] = useState<number>(defaultSubsidy.central);
  const [stateSubsidy, setStateSubsidy] = useState<number>(defaultSubsidy.state);

  // Extra Costs (Optional)
  const [extraStructureEnabled, setExtraStructureEnabled] = useState(false);
  const [extraStructureRate, setExtraStructureRate] = useState<number>(5); // Rate per watt

  const [extraPanelsEnabled, setExtraPanelsEnabled] = useState(false);
  const [extraPanelCount, setExtraPanelCount] = useState<number>(1);
  const [extraPanelPrice, setExtraPanelPrice] = useState<number>(15000); // Per panel price

  const [extraWireEnabled, setExtraWireEnabled] = useState(false);
  const [extraWireLength, setExtraWireLength] = useState<number>(10); // in meters
  const [extraWireRate, setExtraWireRate] = useState<number>(50); // Per meter rate

  // Components (Bill of Materials)
  const [components, setComponents] = useState<QuotationComponent[]>([]);
  const [terms, setTerms] = useState<string[]>([]);

  // UI State
  const [loading, setLoading] = useState(false);

  // ===== EDIT MODE: Load quotation data from URL param =====
  useEffect(() => {
    if (!editId || editLoaded) return;

    const loadQuotation = async () => {
      try {
        setLoading(true);
        const res = await apiFetch(`/api/quotations/${editId}`);
        const result = await res.json();
        if (!result.success || !result.data) {
          setNotification({ open: true, message: "Failed to load quotation for editing", severity: "error" });
          return;
        }

        const q = result.data;
        setEditingQuotationId(q.id);

        // If form_data is saved (full form snapshot), use it for exact restoration
        const fd = q.form_data;
        if (fd) {
          // Restore all form fields from snapshot
          if (fd.selectedCompanyId) setSelectedCompanyId(fd.selectedCompanyId);
          if (fd.selectedSystemType) setSelectedSystemType(fd.selectedSystemType);
          if (fd.capacityKw !== undefined) setCapacityKw(fd.capacityKw);
          if (fd.phase !== undefined) setPhase(fd.phase);
          if (fd.panelWattage !== undefined) setPanelWattage(fd.panelWattage);
          if (fd.panelBrand) setPanelBrand(fd.panelBrand);
          if (fd.customPanelBrand) setCustomPanelBrand(fd.customPanelBrand);
          if (fd.panelType) setPanelType(fd.panelType);
          if (fd.panelWarranty) setPanelWarranty(fd.panelWarranty);
          if (fd.inverterBrand) setInverterBrand(fd.inverterBrand);
          if (fd.customInverterBrand) setCustomInverterBrand(fd.customInverterBrand);
          if (fd.inverterModel) { setInverterModel(fd.inverterModel); setInverterModelEdited(true); }
          if (fd.inverterWarranty) setInverterWarranty(fd.inverterWarranty);
          if (fd.batteryWarranty) setBatteryWarranty(fd.batteryWarranty);
          if (fd.customBatteryWarranty) setCustomBatteryWarranty(fd.customBatteryWarranty);
          if (fd.priceInput !== undefined) setPriceInput(fd.priceInput);
          if (fd.gstRate !== undefined) setGstRate(fd.gstRate);
          if (fd.centralSubsidy !== undefined) setCentralSubsidy(fd.centralSubsidy);
          if (fd.stateSubsidy !== undefined) setStateSubsidy(fd.stateSubsidy);
          // Extra costs
          if (fd.extraStructureEnabled !== undefined) setExtraStructureEnabled(fd.extraStructureEnabled);
          if (fd.extraStructureRate !== undefined) setExtraStructureRate(fd.extraStructureRate);
          if (fd.extraPanelsEnabled !== undefined) setExtraPanelsEnabled(fd.extraPanelsEnabled);
          if (fd.extraPanelCount !== undefined) setExtraPanelCount(fd.extraPanelCount);
          if (fd.extraPanelPrice !== undefined) setExtraPanelPrice(fd.extraPanelPrice);
          if (fd.extraWireEnabled !== undefined) setExtraWireEnabled(fd.extraWireEnabled);
          if (fd.extraWireLength !== undefined) setExtraWireLength(fd.extraWireLength);
          if (fd.extraWireRate !== undefined) setExtraWireRate(fd.extraWireRate);
          // Service state restore
          if (fd.serviceItems) setServiceItems(fd.serviceItems);
          if (fd.serviceTerms) setServiceTerms(fd.serviceTerms);
          if (fd.serviceGst !== undefined) setServiceGst(fd.serviceGst);
          if (fd.serviceProposalTitle) setServiceProposalTitle(fd.serviceProposalTitle);
          // B2B state restore
          if (fd.b2bItems) setB2bItems(fd.b2bItems);
          if (fd.b2bTerms) {
            setB2bTerms(
              fd.b2bTerms
                .filter((t: string) => !t.toLowerCase().includes("warranty: 25 year") && !t.toLowerCase().includes("warranty: 25-year"))
                .map((t: string) => t.replace(/\.?\s*Tata Structure also available upon confirmation\.?/gi, "").trim())
            );
          }
          if (fd.b2bProposalTitle) setB2bProposalTitle(fd.b2bProposalTitle);
          if (fd.b2bStructureMake) setB2bStructureMake(fd.b2bStructureMake);
          if (fd.b2bClientGstin) setB2bClientGstin(fd.b2bClientGstin);
          if (fd.b2bDispatchLocation) setB2bDispatchLocation(fd.b2bDispatchLocation);
          if (fd.b2bPaymentTerms) setB2bPaymentTerms(fd.b2bPaymentTerms);
          if (fd.b2bDeliveryDays) setB2bDeliveryDays(fd.b2bDeliveryDays);
          if (fd.b2bValidDays !== undefined) setB2bValidDays(fd.b2bValidDays);
        } else {
          // Fallback: restore from basic quotation fields
          if (q.capacity_kw) setCapacityKw(q.capacity_kw);
          if (q.phase) setPhase(q.phase);
          if (q.brand) setPanelBrand(panelBrands.includes(q.brand) ? q.brand : "Other");
          if (q.brand && !panelBrands.includes(q.brand)) setCustomPanelBrand(q.brand);
          if (q.gst_rate) setGstRate(q.gst_rate);
          if (q.central_subsidy !== undefined) setCentralSubsidy(q.central_subsidy || 0);
          if (q.state_subsidy !== undefined) setStateSubsidy(q.state_subsidy || 0);
          // Reconstruct price input from base_price (inc GST)
          if (q.base_price && q.gst_rate) {
            setPriceInput(Math.round(q.base_price * (1 + (q.gst_rate || 0) / 100)));
          }
        }

        // Always restore customer info and components/terms
        setCustomerName(q.customer_name || "");
        setCustomerPhone(q.customer_phone || "");
        setCustomerAddress(q.customer_address || "");
        if (q.components && Array.isArray(q.components) && q.components.length > 0) {
          setComponents(q.components);
        }
        if (q.terms && Array.isArray(q.terms) && q.terms.length > 0) {
          setTerms(q.terms);
        }

        setEditLoaded(true);
        setNotification({ open: true, message: `Editing quotation for ${q.customer_name}`, severity: "info" });
      } catch (error) {
        console.error("Failed to load quotation:", error);
        setNotification({ open: true, message: "Failed to load quotation", severity: "error" });
      } finally {
        setLoading(false);
      }
    };

    loadQuotation();
  }, [editId, editLoaded]);

  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: "success" | "error" | "info" | "warning" }>({ open: false, message: "", severity: "success" });
  const [whatsAppModal, setWhatsAppModal] = useState<{
    open: boolean;
    phone: string;
    message: string;
    pdfUrl: string | null;
  }>({
    open: false,
    phone: '',
    message: '',
    pdfUrl: null,
  });
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [editComponentDialog, setEditComponentDialog] = useState(false);
  const [editingComponent, setEditingComponent] = useState<QuotationComponent | null>(null);
  const [editingIndex, setEditingIndex] = useState<number>(-1);
  const [addComponentDialog, setAddComponentDialog] = useState(false);
  const [newComponent, setNewComponent] = useState<QuotationComponent>({ name: "", description: "", quantity: "1 Nos", make: "Standard", sort_order: 0 });

  // Service Mode State
  const isServiceMode = selectedSystemType === "Service";
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>(JSON.parse(JSON.stringify(defaultServiceItems)));
  const [serviceTerms, setServiceTerms] = useState<string[]>([...defaultServiceTerms]);
  const [serviceGst, setServiceGst] = useState(serviceGstRate);
  const [serviceProposalTitle, setServiceProposalTitle] = useState("PROPOSAL FOR O&M SERVICES");
  const [editTermIdx, setEditTermIdx] = useState(-1);
  const [editTermText, setEditTermText] = useState("");

  const serviceSubtotal = useMemo(() => +serviceItems.reduce((s, i) => s + (Number(i.amount) || 0), 0).toFixed(2), [serviceItems]);
  const serviceGstAmount = useMemo(() => +(serviceSubtotal * (Number(serviceGst) || 0) / 100).toFixed(2), [serviceSubtotal, serviceGst]);
  const serviceGrandTotal = useMemo(() => +(serviceSubtotal + serviceGstAmount).toFixed(2), [serviceSubtotal, serviceGstAmount]);
  const serviceRefNumber = useMemo(() => {
    const prefix = (activeCompany as any).quote_prefix || (activeCompany as any).quotePrefix || "KSS";
    return generateServiceRefNumber(prefix);
  }, [activeCompany]);

  const updateServiceItem = (idx: number, field: keyof ServiceItem, val: string | number) => {
    const updated = [...serviceItems];
    (updated[idx] as any)[field] = val;
    if (field === "rate" || field === "qty" || field === "unit") {
      const qty = parseFloat(updated[idx].qty) || 0;
      const rate = updated[idx].rate || 0;
      if (updated[idx].unit === "Month") {
        // Rate is per month, amount = qty * rate * 12 (yearly total)
        updated[idx].amount = qty * rate * 12;
        updated[idx].monthlyRate = rate;
      } else {
        // Rate is per year, amount = qty * rate
        updated[idx].amount = qty * rate;
        updated[idx].monthlyRate = +(updated[idx].amount / 12).toFixed(2);
      }
    }
    setServiceItems(updated);
  };

  // ===== B2B / STRUCTURE MODE STATE =====
  const isB2BMode = selectedSystemType === "ApolloB2B";
  const [b2bItems, setB2bItems] = useState<ApolloLineItem[]>([]);
  const [b2bTerms, setB2bTerms] = useState<string[]>([...defaultB2BTerms]);
  const [b2bProposalTitle, setB2bProposalTitle] = useState("COMMERCIAL QUOTATION FOR SOLAR MOUNTING STRUCTURE & BOS");
  const [b2bStructureMake, setB2bStructureMake] = useState<"APOLLO" | "TATA" | "APOLLO / TATA">("APOLLO");
  const [b2bClientGstin, setB2bClientGstin] = useState("");
  const [b2bDispatchLocation, setB2bDispatchLocation] = useState("Ex-Factory Pithampur / Indore / Varanasi");
  const [b2bPaymentTerms, setB2bPaymentTerms] = useState("100% Advance against PI before dispatch");
  const [b2bDeliveryDays, setB2bDeliveryDays] = useState("3-5 business days upon PO receipt");
  const [b2bValidDays, setB2bValidDays] = useState(7);
  const [b2bSelectedCat, setB2bSelectedCat] = useState<string>("All");
  const [b2bSearchQuery, setB2bSearchQuery] = useState("");
  const [b2bCatalog, setB2bCatalog] = useState<ApolloProduct[]>(apolloProductsCatalog);

  const fetchB2BCatalog = useCallback(() => {
    apiFetch("/api/structure-catalog")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setB2bCatalog(json.data);
        }
      })
      .catch(() => console.log("Using default structure catalog fallback"));
  }, []);

  useEffect(() => {
    fetchB2BCatalog();
  }, [fetchB2BCatalog, selectedSystemType]);

  const [editB2BTermIdx, setEditB2BTermIdx] = useState(-1);
  const [editB2BTermText, setEditB2BTermText] = useState("");
  const [addB2BCustomDialog, setAddB2BCustomDialog] = useState(false);
  const [customB2BItem, setCustomB2BItem] = useState({
    name: "",
    sku: "",
    category: "G.I. Solar Mounting Structure",
    unit: "Pcs",
    basePrice: 0,
    qty: 1,
    gstRate: 18,
  });

  const b2bSubtotal = useMemo(() => {
    const sum = b2bItems.reduce((acc, item) => acc + ((Number(item.basePrice) || 0) * (Number(item.qty) || 0)), 0);
    return +sum.toFixed(2);
  }, [b2bItems]);
  const b2bGstAmount = useMemo(() => {
    const totalGst = b2bItems.reduce((acc, item) => {
      const rate = item.gstRate !== undefined ? Number(item.gstRate) : 18;
      const itemBase = (Number(item.basePrice) || 0) * (Number(item.qty) || 0);
      return acc + ((itemBase * rate) / 100);
    }, 0);
    return +totalGst.toFixed(2);
  }, [b2bItems]);
  const b2bGrandTotal = useMemo(() => Math.round(b2bSubtotal + b2bGstAmount), [b2bSubtotal, b2bGstAmount]);

  // Determine if single uniform GST rate or mixed rates across line items
  const b2bUniqueGstRates = useMemo(() => Array.from(new Set(b2bItems.map(it => it.gstRate !== undefined ? Number(it.gstRate) : 18))), [b2bItems]);
  const b2bGstLabel = useMemo(() => {
    if (b2bUniqueGstRates.length === 1) {
      const r = b2bUniqueGstRates[0];
      const half = +(r / 2).toFixed(1);
      return `GST @ ${r}% (CGST ${half}% + SGST ${half}%):`;
    }
    return `Total GST (CGST + SGST):`;
  }, [b2bUniqueGstRates]);

  const [b2bRefNumber, setB2bRefNumber] = useState("APL-2026-1001");
  useEffect(() => {
    setB2bRefNumber(`APL-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`);
  }, []);

  const addB2BItem = (prod: ApolloProduct) => {
    const existingIdx = b2bItems.findIndex(it => it.sku === prod.sku);
    if (existingIdx >= 0) {
      const updated = [...b2bItems];
      updated[existingIdx].qty += 1;
      updated[existingIdx].amount = +(updated[existingIdx].qty * updated[existingIdx].basePrice).toFixed(2);
      setB2bItems(updated);
      setNotification({ open: true, message: `Increased quantity for ${prod.name} (Qty: ${updated[existingIdx].qty})`, severity: "info" });
      return;
    }
    const newItem: ApolloLineItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      productId: prod.id,
      name: prod.name,
      sku: prod.sku,
      category: prod.category,
      unit: prod.unit,
      basePrice: prod.basePrice,
      qty: 1,
      gstRate: prod.gstRate !== undefined ? Number(prod.gstRate) : 18,
      amount: +(prod.basePrice * 1).toFixed(2),
    };
    setB2bItems([...b2bItems, newItem]);
    setNotification({ open: true, message: `Added ${prod.name} (${newItem.gstRate}% GST) to quotation`, severity: "success" });
  };

  const updateB2BItem = (idx: number, field: keyof ApolloLineItem, val: any) => {
    const updated = [...b2bItems];
    (updated[idx] as any)[field] = (field === "basePrice" || field === "qty" || field === "gstRate")
      ? (parseFloat(val) || 0)
      : val;
    if (field === "basePrice" || field === "qty") {
      const p = field === "basePrice" ? (parseFloat(val) || 0) : updated[idx].basePrice;
      const q = field === "qty" ? (parseFloat(val) || 0) : updated[idx].qty;
      updated[idx].amount = +(p * q).toFixed(2);
    }
    setB2bItems(updated);
  };

  const removeB2BItem = (idx: number) => {
    setB2bItems(b2bItems.filter((_, i) => i !== idx));
  };

  const handleAddCustomB2BItem = () => {
    if (!customB2BItem.name) return;
    const newItem: ApolloLineItem = {
      id: `custom-${Date.now()}`,
      name: customB2BItem.name,
      sku: customB2BItem.sku || `CUST-${Math.floor(100 + Math.random() * 900)}`,
      category: customB2BItem.category,
      unit: customB2BItem.unit,
      basePrice: Number(customB2BItem.basePrice) || 0,
      qty: Number(customB2BItem.qty) || 1,
      gstRate: typeof customB2BItem.gstRate === 'number' && !isNaN(customB2BItem.gstRate) ? customB2BItem.gstRate : 18,
      amount: +((Number(customB2BItem.basePrice) || 0) * (Number(customB2BItem.qty) || 1)).toFixed(2),
    };
    setB2bItems([...b2bItems, newItem]);
    setCustomB2BItem({ name: "", sku: "", category: "G.I. Solar Mounting Structure", unit: "Pcs", basePrice: 0, qty: 1, gstRate: 18 });
    setAddB2BCustomDialog(false);
    setNotification({ open: true, message: `Added custom item "${newItem.name}" (${newItem.gstRate}% GST)`, severity: "success" });
  };

  const filteredB2BCatalog = useMemo(() => {
    return b2bCatalog.filter((prod) => {
      const matchCat = b2bSelectedCat === "All" || prod.category === b2bSelectedCat;
      const matchQuery = !b2bSearchQuery.trim() ||
        prod.name.toLowerCase().includes(b2bSearchQuery.toLowerCase()) ||
        prod.sku.toLowerCase().includes(b2bSearchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [b2bCatalog, b2bSelectedCat, b2bSearchQuery]);

  const printRef = useRef<HTMLDivElement>(null);

  // Calculate number of panels needed
  const numberOfPanels = useMemo(() => Math.ceil((capacityKw * 1000) / (panelWattage || 1)), [capacityKw, panelWattage]);
  const actualSystemSize = useMemo(() => +((numberOfPanels * (panelWattage || 0)) / 1000).toFixed(2), [numberOfPanels, panelWattage]);

  // Load components from API (or fall back to hardcoded defaults) when system type changes
  const fetchComponentsFromApi = useCallback(async (systemType: string) => {
    // Skip fetching if in edit mode and data hasn't been loaded yet
    if (editingQuotationId && !editLoaded) return;
    try {
      const res = await apiFetch(`/api/components?system_type=${encodeURIComponent(systemType)}`);
      const data = await res.json();
      if (data.success && data.data && data.data.length > 0 && !data.fromDefaults) {
        // Got components from DB — use them as base, apply current panel/inverter info
        const dbComponents = data.data.map((c: any, i: number) => ({
          name: c.name,
          description: c.description || '',
          quantity: c.default_quantity || c.quantity || '1 Nos',
          make: c.default_make || c.make || 'Standard',
          sort_order: c.sort_order ?? i,
        }));
        // Update first component (panels) and second (inverter) with current form values
        const updatedComponents = dbComponents.map((c: any, i: number) => {
          if (i === 0) return { ...c, description: `${panelWattage}Wp (${panelType}) Modules`, quantity: `${numberOfPanels.toString().padStart(2, '0')} Nos`, make: effectivePanelBrand };
          if (i === 1) return { ...c, description: inverterModel, make: effectiveInverterBrand };
          return c;
        });
        setComponents(updatedComponents);
      } else {
        // Fall back to hardcoded defaults
        const defaults = defaultComponents[systemType as keyof typeof defaultComponents];
        if (defaults) {
          const updatedDefaults = defaults.map((c, i) => {
            if (i === 0) return { ...c, description: `${panelWattage}Wp (${panelType}) Modules`, quantity: `${numberOfPanels.toString().padStart(2, '0')} Nos`, make: effectivePanelBrand, sort_order: i };
            if (i === 1) return { ...c, description: inverterModel, make: effectiveInverterBrand, sort_order: i };
            return { ...c, sort_order: i };
          });
          setComponents(updatedDefaults);
        }
      }
    } catch {
      // On error, fall back to hardcoded defaults
      const defaults = defaultComponents[systemType as keyof typeof defaultComponents];
      if (defaults) {
        const updatedDefaults = defaults.map((c, i) => {
          if (i === 0) return { ...c, description: `${panelWattage}Wp (${panelType}) Modules`, quantity: `${numberOfPanels.toString().padStart(2, '0')} Nos`, make: effectivePanelBrand, sort_order: i };
          if (i === 1) return { ...c, description: inverterModel, make: effectiveInverterBrand, sort_order: i };
          return { ...c, sort_order: i };
        });
        setComponents(updatedDefaults);
      }
    }
    const defaultTermsList = defaultTerms[systemType as keyof typeof defaultTerms];
    if (defaultTermsList) setTerms(defaultTermsList.slice(0, 8));
  }, [panelWattage, effectivePanelBrand, panelType, numberOfPanels, effectiveInverterBrand, inverterModel, editingQuotationId, editLoaded]);

  useEffect(() => {
    if (!isServiceMode && !isB2BMode) {
      fetchComponentsFromApi(selectedSystemType);
    }
  }, [selectedSystemType, panelWattage, effectivePanelBrand, panelType, numberOfPanels, effectiveInverterBrand, inverterModel, isServiceMode, isB2BMode, fetchComponentsFromApi]);

  // Update inverter model when capacity changes (only if not manually edited)
  useEffect(() => {
    if (!inverterModelEdited) {
      const inverterCapacity = Math.max(1, Math.floor(capacityKw));
      setInverterModel(`${inverterCapacity} KW ${selectedSystemType} String`);
    }
  }, [capacityKw, selectedSystemType, inverterModelEdited]);

  // Handle Subsidy Logic: No subsidy for NDCR, Off-grid, VFD/Drive, ApolloB2B, Service
  useEffect(() => {
    if (
      panelType === "NDCR" ||
      selectedSystemType === "Off-grid" ||
      selectedSystemType === "VFD/Drive" ||
      selectedSystemType === "ApolloB2B" ||
      selectedSystemType === "Service"
    ) {
      setCentralSubsidy(0);
      setStateSubsidy(0);
    } else {
      // Use official PM Surya Ghar capacity-based subsidy tiers
      const subsidy = getSubsidyForCapacity(capacityKw);
      setCentralSubsidy(subsidy.central);
      setStateSubsidy(subsidy.state);
    }
  }, [panelType, selectedSystemType, capacityKw]);

  // Calculate extra costs
  const extraCosts = useMemo(() => {
    const structureCost = extraStructureEnabled ? ((Number(actualSystemSize) || 0) * 1000 * (Number(extraStructureRate) || 0)) : 0;
    const panelsCost = extraPanelsEnabled ? ((Number(extraPanelCount) || 0) * (Number(extraPanelPrice) || 0)) : 0;
    const wireCost = extraWireEnabled ? ((Number(extraWireLength) || 0) * (Number(extraWireRate) || 0)) : 0;
    const total = +(structureCost + panelsCost + wireCost).toFixed(2);
    return { structureCost, panelsCost, wireCost, total };
  }, [extraStructureEnabled, extraStructureRate, actualSystemSize, extraPanelsEnabled, extraPanelCount, extraPanelPrice, extraWireEnabled, extraWireLength, extraWireRate]);

  // Calculate GST and totals (Reverse calculation from Inclusive Price)
  const calculations = useMemo(() => {
    // Reverse calculate base price from the input (which is GST inclusive)
    // Formula: Inclusive = Base * (1 + Rate)  =>  Base = Inclusive / (1 + Rate)
    const safePriceInput = Math.max(0, Number(priceInput) || 0);
    const safeGstRate = Math.max(0, Number(gstRate) || 0);
    const derivedBasePrice = safeGstRate > 0 ? +(safePriceInput / (1 + safeGstRate / 100)).toFixed(2) : safePriceInput;

    // Add extra costs to the derived base
    const totalTaxableValue = +(derivedBasePrice + (extraCosts.total || 0)).toFixed(2);

    const gstAmount = +(totalTaxableValue * (safeGstRate / 100)).toFixed(2);
    const totalAmount = +(totalTaxableValue + gstAmount).toFixed(2);

    const safeCentral = Math.max(0, Number(centralSubsidy) || 0);
    const safeState = Math.max(0, Number(stateSubsidy) || 0);
    const savings = calculateSavings(actualSystemSize, totalAmount, safeCentral, safeState);
    const effectiveCost = Math.max(0, +(totalAmount - safeCentral - safeState).toFixed(2));

    return {
      basePrice: totalTaxableValue, // Total taxable base used for calculation
      originalBasePrice: derivedBasePrice, // Base price of the system only
      extraCostsTotal: extraCosts.total,
      gstRate: safeGstRate,
      gstAmount,
      totalAmount,
      ...savings,
      effectiveCost,
      systemPriceIncGst: safePriceInput // Keep track of the input
    };
  }, [priceInput, extraCosts.total, gstRate, actualSystemSize, centralSubsidy, stateSubsidy]);

  const quoteNumber = useMemo(() => {
    if (!customerName) return "";
    const initials = customerName.split(" ").map((n) => n.charAt(0).toUpperCase()).join("");
    return generateQuoteNumber(initials);
  }, [customerName]);

  const currentDate = useMemo(() => new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }), []);

  const printPageStyle = `
    @page {
      size: A4 portrait;
      margin: 12mm 12mm 14mm 12mm;
    }
    @media print {
      *, *:before, *:after {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        height: auto !important;
        overflow: visible !important;
      }
      .print-page {
        width: 100% !important;
        max-width: 100% !important;
        min-height: auto !important;
        height: auto !important;
        padding: 0 !important;
        margin: 0 !important;
        border: none !important;
        box-shadow: none !important;
        background: #ffffff !important;
        box-sizing: border-box !important;
      }
      .avoid-break {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      table {
        width: 100% !important;
        border-collapse: collapse !important;
        break-inside: auto !important;
        page-break-inside: auto !important;
      }
      thead {
        display: table-header-group !important;
      }
      tfoot {
        display: table-footer-group !important;
      }
      tbody {
        break-inside: auto !important;
        page-break-inside: auto !important;
      }
      tr {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      th, td {
        word-break: break-word !important;
      }
      .print-table-wrapper {
        overflow: visible !important;
      }
    }
  `;

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Quotation_${customerName.replace(/\s+/g, "_") || "Solar"}_${new Date().toISOString().slice(0, 10)}`,
    pageStyle: printPageStyle,
  });

  const handleEditComponent = (index: number) => { setEditingComponent({ ...components[index] }); setEditingIndex(index); setEditComponentDialog(true); };
  const handleSaveComponentEdit = () => { if (editingComponent && editingIndex >= 0) { const updated = [...components]; updated[editingIndex] = editingComponent; setComponents(updated); } setEditComponentDialog(false); setEditingComponent(null); setEditingIndex(-1); };
  const handleDeleteComponent = (index: number) => setComponents(components.filter((_, i) => i !== index));
  const handleAddComponent = () => { if (newComponent.name) { setComponents([...components, { ...newComponent, sort_order: components.length }]); setNewComponent({ name: "", description: "", quantity: "1 Nos", make: "Standard", sort_order: 0 }); setAddComponentDialog(false); } };

  const handleReset = () => {
    setCustomerName(""); setCustomerPhone(""); setCustomerAddress(""); setCapacityKw(3); setPhase(1); setPanelWattage(620); setPanelBrand("Adani"); setPriceInput(180000); setInverterModel("3 KW On-Grid String"); setInverterModelEdited(false);
    setB2bClientGstin("");
    // Clear edit mode
    if (editingQuotationId) {
      setEditingQuotationId(null);
      setEditLoaded(false);
      router.push('/', { scroll: false });
    }
  };

  // Build form_data snapshot for round-trip editing
  const getFormDataSnapshot = useCallback(() => ({
    selectedCompanyId,
    selectedSystemType,
    capacityKw,
    phase,
    panelWattage,
    panelBrand,
    customPanelBrand,
    panelType,
    panelWarranty,
    inverterBrand,
    customInverterBrand,
    inverterModel,
    inverterWarranty,
    batteryWarranty,
    customBatteryWarranty,
    priceInput,
    gstRate,
    centralSubsidy,
    stateSubsidy,
    extraStructureEnabled,
    extraStructureRate,
    extraPanelsEnabled,
    extraPanelCount,
    extraPanelPrice,
    extraWireEnabled,
    extraWireLength,
    extraWireRate,
    // Service snapshot
    serviceItems,
    serviceTerms,
    serviceGst,
    serviceProposalTitle,
    // B2B snapshot
    b2bItems,
    b2bTerms,
    b2bProposalTitle,
    b2bStructureMake,
    b2bClientGstin,
    b2bDispatchLocation,
    b2bPaymentTerms,
    b2bDeliveryDays,
    b2bValidDays,
  }), [selectedCompanyId, selectedSystemType, capacityKw, phase, panelWattage, panelBrand, customPanelBrand, panelType, panelWarranty, inverterBrand, customInverterBrand, inverterModel, inverterWarranty, batteryWarranty, customBatteryWarranty, priceInput, gstRate, centralSubsidy, stateSubsidy, extraStructureEnabled, extraStructureRate, extraPanelsEnabled, extraPanelCount, extraPanelPrice, extraWireEnabled, extraWireLength, extraWireRate, serviceItems, serviceTerms, serviceGst, serviceProposalTitle, b2bItems, b2bTerms, b2bProposalTitle, b2bStructureMake, b2bClientGstin, b2bDispatchLocation, b2bPaymentTerms, b2bDeliveryDays, b2bValidDays]);

  const saveToDatabase = async (pdfUrl?: string, status: string = 'draft', pdfStoragePath?: string) => {
    if (!customerName) return;
    try {
      const isEditing = !!editingQuotationId;
      const url = isEditing ? `/api/quotations/${editingQuotationId}` : "/api/quotations";
      const method = isEditing ? "PUT" : "POST";

      const baseAmount = isB2BMode ? b2bSubtotal : isServiceMode ? serviceSubtotal : calculations.basePrice;
      const effectiveGstRate = isB2BMode ? 18 : isServiceMode ? serviceGst : gstRate;
      const effectiveGstAmount = isB2BMode ? b2bGstAmount : isServiceMode ? serviceGstAmount : calculations.gstAmount;
      const effectiveTotalAmount = isB2BMode ? b2bGrandTotal : isServiceMode ? serviceGrandTotal : calculations.totalAmount;
      const effectiveTerms = isB2BMode ? b2bTerms : isServiceMode ? serviceTerms : terms;
      const effectiveComponents = isB2BMode
        ? b2bItems.map((it, idx) => ({
          name: it.name,
          description: `${it.sku} [${it.category}] - ${it.unit} @ ₹${it.basePrice}`,
          quantity: `${it.qty} ${it.unit}`,
          make: b2bStructureMake,
          sort_order: idx,
        }))
        : components;

      const response = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_id: activeCompany.id,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_address: customerAddress,
          system_type_name: selectedSystemType,
          capacity_kw: isB2BMode || isServiceMode ? null : actualSystemSize,
          phase: isB2BMode || isServiceMode ? 1 : phase,
          brand: isB2BMode ? b2bStructureMake : effectivePanelBrand,
          base_price: baseAmount,
          gst_rate: effectiveGstRate,
          gst_amount: effectiveGstAmount,
          total_amount: effectiveTotalAmount,
          central_subsidy: isB2BMode || isServiceMode ? 0 : centralSubsidy,
          state_subsidy: isB2BMode || isServiceMode ? 0 : stateSubsidy,
          terms: effectiveTerms,
          components: effectiveComponents,
          salesperson: activeCompany.authorizedSignatory,
          pdf_url: pdfUrl,
          pdf_storage_path: pdfStoragePath,
          status: status,
          form_data: getFormDataSnapshot(),
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to save quotation");
      }
      // If new quotation, set editing ID for future updates
      if (!isEditing && result.data?.id) {
        setEditingQuotationId(result.data.id);
      }
      console.log(`Quotation ${isEditing ? 'updated' : 'created'} in database`);
      return result.data;
    } catch (error) {
      console.error("Save failed:", error);
      return null;
    }
  };

  // Get quotation data for sharing
  const getQuotationData = () => ({
    customerName,
    systemSize: actualSystemSize,
    panelBrand: effectivePanelBrand,
    panelWattage,
    panelType,
    inverterModel,
    totalAmount: calculations.totalAmount,
    effectiveCost: calculations.effectiveCost,
    centralSubsidy,
    stateSubsidy
  });

  // Build quote data for PDF generation (reused by WhatsApp, Print, Save)
  const buildQuoteData = (options?: { skipWhatsApp?: boolean }) => {
    if (isB2BMode) {
      return {
        customerInfo: {
          name: customerName,
          phone: customerPhone,
          address: customerAddress || "",
          gstin: b2bClientGstin || "",
        },
        selectedProduct: {
          systemType: "Solar Mounting Structure & BOS (B2B)",
          capacity: 0,
          phase: 1,
          panelBrand: b2bStructureMake,
          panelWattage: 0,
          panelType: "Pre-Galv / Hot Dip 80+ Micron",
          panelWarranty: "25 Years",
          inverterBrand: "APOLLO Structure",
          inverterWarranty: "Standard",
          batteryWarranty: "N/A",
        },
        calculations: {
          basePrice: b2bSubtotal,
          extraCosts: 0,
          subtotal: b2bSubtotal,
          gstAmount: b2bGstAmount,
          total: b2bGrandTotal,
          discount: 0,
          grandTotal: b2bGrandTotal,
          centralSubsidy: 0,
          stateSubsidy: 0,
          effectiveCost: b2bGrandTotal,
        },
        savings: {
          monthlyUnits: 0,
          monthlySavings: 0,
          annualSavings: 0,
          twentyFiveYearSavings: 0,
          paybackYears: 0,
          roiPercent: 0,
          co2Avoided: 0,
          treesPlanted: 0,
        },
        taxRate: 0.18,
        components: b2bItems.map((it, idx) => ({
          name: it.name,
          description: `${it.sku} [${it.category}] - ${it.unit} @ ₹${it.basePrice}`,
          quantity: `${it.qty} ${it.unit}`,
          make: b2bStructureMake,
          sort_order: idx,
        })),
        terms: b2bTerms,
        companyDetails: activeCompany,
        vendor_id: activeCompany.id,
        skipWhatsApp: options?.skipWhatsApp ?? true,
      };
    }

    return {
      customerInfo: {
        name: customerName,
        phone: customerPhone,
        address: customerAddress || ""
      },
      selectedProduct: {
        systemType: selectedSystemType,
        capacity: actualSystemSize,
        phase: phase,
        panelBrand: effectivePanelBrand,
        panelWattage: panelWattage,
        panelType: panelType,
        panelWarranty: panelWarranty,
        inverterBrand: inverterModel,
        inverterWarranty: inverterWarranty,
        batteryWarranty: effectiveBatteryWarranty,
      },
      calculations: {
        basePrice: calculations.originalBasePrice,
        extraCosts: extraCosts.total,
        subtotal: calculations.basePrice,
        gstAmount: calculations.gstAmount,
        total: calculations.totalAmount,
        discount: 0,
        grandTotal: calculations.totalAmount,
        centralSubsidy,
        stateSubsidy,
        effectiveCost: calculations.effectiveCost
      },
      savings: calculations,
      taxRate: gstRate / 100,
      components,
      terms,
      companyDetails: activeCompany,
      vendor_id: activeCompany.id,
      skipWhatsApp: options?.skipWhatsApp ?? true,
    };
  };

  // Generate PDF, upload to Supabase, and save to DB (reusable)
  const generateAndSavePdf = async (status: string = 'saved'): Promise<string | null> => {
    if (!customerName) { setNotification({ open: true, message: "Customer name is required", severity: "error" }); return null; }
    try {
      const quoteData = buildQuoteData({ skipWhatsApp: true });
      const response = await apiFetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quoteData)
      });
      const result = await response.json();
      if (response.ok && result.url) {
        await saveToDatabase(result.url, status, result.pdf_storage_path);
        return result.url;
      } else {
        // Fallback: save to DB directly even if puppeteer PDF upload is unavailable
        await saveToDatabase(undefined, status);
        return null;
      }
    } catch (error) {
      console.error("PDF generation error:", error);
      await saveToDatabase(undefined, status);
      return null;
    }
  };

  // Print handler — also generates PDF + saves
  const handlePrintWithSave = async () => {
    if (!customerName) { setNotification({ open: true, message: "Customer name is required", severity: "error" }); return; }
    setLoading(true);
    setNotification({ open: true, message: "Saving quotation and opening print...", severity: "info" });
    try {
      await generateAndSavePdf('Printed');
      handlePrint();
      setNotification({ open: true, message: "✅ Quotation saved and print dialog ready!", severity: "success" });
    } catch (error) {
      console.warn("Print save warning:", error);
      handlePrint();
      setNotification({ open: true, message: "Printed (Saved offline draft)", severity: "warning" });
    } finally { setLoading(false); }
  };

  // WhatsApp handler - generates PDF, uploads to Supabase Storage, and opens direct WhatsApp chat
  const handleSendWhatsApp = async () => {
    if (!customerName?.trim()) {
      setNotification({ open: true, message: "Customer name is required", severity: "error" });
      return;
    }
    if (!customerPhone?.trim()) {
      setNotification({ open: true, message: "Customer phone is required for WhatsApp", severity: "error" });
      return;
    }

    setLoading(true);
    setNotification({
      open: true,
      message: "Generating official PDF and preparing WhatsApp link...",
      severity: "info",
    });

    try {
      // 1. Generate PDF and upload to Supabase Storage
      let pdfUrl: string | null = null;
      let pdfStoragePath: string | undefined = undefined;
      try {
        const quoteData = buildQuoteData({ skipWhatsApp: true });
        const response = await apiFetch("/api/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(quoteData),
        });
        const result = await response.json().catch(() => ({}));
        if (response.ok && result.url) {
          pdfUrl = result.url;
          pdfStoragePath = result.pdf_storage_path;
        }
      } catch (pdfErr) {
        console.warn("PDF generation warning, proceeding with direct WhatsApp text summary:", pdfErr);
      }

      // 2. Save quotation to database with pdfUrl and pdfStoragePath
      const savedRecord = await saveToDatabase(pdfUrl || undefined, "WhatsApp Shared", pdfStoragePath);

      // 3. Build professional WhatsApp message matching transaction format
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const quoteNo = isB2BMode
        ? b2bRefNumber
        : isServiceMode
        ? serviceRefNumber
        : (savedRecord?.quote_number || quoteNumber || "Quote");

      // Mask raw Supabase BaaS storage URL behind your branded website domain
      const brandedPdfUrl = (savedRecord?.quote_number || savedRecord?.id)
        ? `${origin}/api/quote/view/${encodeURIComponent(savedRecord.quote_number || savedRecord.id)}`
        : (pdfUrl || undefined);

      const messageText = buildQuoteWhatsAppMessage({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        quoteNumber: quoteNo,
        quoteDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        systemCapacityKw: isB2BMode || isServiceMode ? undefined : actualSystemSize,
        systemType: selectedSystemType,
        panelBrand: isB2BMode ? b2bStructureMake : effectivePanelBrand,
        panelWattage: panelWattage || undefined,
        totalAmount: isB2BMode ? b2bGrandTotal : isServiceMode ? serviceGrandTotal : calculations.totalAmount,
        centralSubsidy: isB2BMode || isServiceMode ? 0 : centralSubsidy,
        stateSubsidy: isB2BMode || isServiceMode ? 0 : stateSubsidy,
        pdfUrl: brandedPdfUrl || pdfUrl,
        vendorName: activeCompany.name,
        vendorSignatory: activeCompany.authorizedSignatory,
        vendorPhone: activeCompany.phone,
        isB2B: isB2BMode,
        b2bDetails: isB2BMode ? {
          refNumber: b2bRefNumber,
          make: b2bStructureMake,
          itemCount: b2bItems.length,
          taxableSubtotal: b2bSubtotal,
          gstAmount: b2bGstAmount,
          grandTotal: b2bGrandTotal,
          dispatchLocation: b2bDispatchLocation,
          paymentTerms: b2bPaymentTerms,
        } : undefined,
        isService: isServiceMode,
        serviceDetails: isServiceMode ? {
          refNumber: serviceRefNumber,
          itemCount: serviceItems.length,
          grandTotal: serviceGrandTotal,
        } : undefined,
      });

      // 4. Open WhatsApp directly in new window / native app
      openWhatsAppDirect(customerPhone, messageText);

      // 5. Open dialog for easy copy or re-opening
      setWhatsAppModal({
        open: true,
        phone: customerPhone.trim(),
        message: messageText,
        pdfUrl: brandedPdfUrl || pdfUrl,
      });

      setNotification({
        open: true,
        message: "✅ WhatsApp opened with pre-filled quotation & document link!",
        severity: "success",
      });
    } catch (error: any) {
      console.error("WhatsApp error:", error);
      setNotification({ open: true, message: error?.message || "Failed to open WhatsApp", severity: "error" });
    } finally {
      setLoading(false);
    }
  };



  // Email handler
  const [customerEmail, setCustomerEmail] = useState("");
  const handleSendEmail = async () => {
    const emailToUse = customerEmail || prompt("Enter customer email address:");
    if (!emailToUse) { setNotification({ open: true, message: "Email address is required", severity: "error" }); return; }
    if (customerEmail !== emailToUse) setCustomerEmail(emailToUse);

    setLoading(true);
    try {
      // Generate and save PDF first
      try {
        await generateAndSavePdf('Emailed');
      } catch { /* PDF save failure shouldn't block email */ }

      const response = await apiFetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToUse, quotationData: getQuotationData() })
      });
      const result = await response.json();
      if (result.success) {
        if (result.useMailto) {
          window.open(result.mailtoLink, "_blank");
          setNotification({ open: true, message: "Email client opened with quotation details", severity: "success" });
        } else {
          setNotification({ open: true, message: "Email sent successfully!", severity: "success" });
        }
      } else throw new Error(result.message || "Failed to send email");
    } catch (error) { setNotification({ open: true, message: (error as any).message, severity: "error" }); }
    finally { setLoading(false); }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

  const resolveMediaUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    return url.startsWith('/') ? url : `/${url}`;
  };

  return (
    <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, height: { xs: "auto", md: "100vh" }, bgcolor: "#f1f5f9", overflow: { xs: "auto", md: "hidden" } }}>
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 12mm 12mm 14mm 12mm;
        }
        @media print {
          *, *:before, *:after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          .no-print { display: none !important; }
          
          body, html { 
            visibility: hidden; 
            height: auto !important; 
            overflow: visible !important; 
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          /* Wrapper resets body/container layout */
          .print-wrapper { 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 100% !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            visibility: visible !important;
            background: white !important;
            overflow: visible !important;
          }

          .print-wrapper * { visibility: visible; }

          /* The actual A4 Page - In print mode, let @page handle real paper margins */
          .print-page { 
            visibility: visible !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important; 
            margin: 0 !important;
            border: none !important; 
            box-shadow: none !important;
            height: auto !important;
            min-height: auto !important;
            background: white !important;
            box-sizing: border-box !important;
          }

          /* Smart Page Breaks */
          table { 
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto; 
            break-inside: auto;
          }
          thead { display: table-header-group !important; }
          tfoot { display: table-footer-group !important; }
          tbody { break-inside: auto !important; page-break-inside: auto !important; }
          tr { 
            break-inside: avoid !important;
            page-break-inside: avoid !important; 
            page-break-after: auto; 
          }
          th, td { word-break: break-word !important; }
          .print-table-wrapper { overflow: visible !important; }
          
          .avoid-break { 
            page-break-inside: avoid !important; 
            break-inside: avoid !important; 
          }
        }
      `}</style>
      {/* LEFT EDIT PANEL */}
      <Box className="no-print" sx={{ width: { xs: "100%", md: 380 }, minWidth: { xs: "100%", md: 380 }, bgcolor: "white", borderRight: { xs: "none", md: "1px solid #e2e8f0" }, borderBottom: { xs: "1px solid #e2e8f0", md: "none" }, display: "flex", flexDirection: "column", overflow: "hidden", height: { xs: "auto", md: "100%" } }}>
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: "1px solid #e2e8f0", bgcolor: "#1e3a5f", color: "white" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ fontSize: 15, display: "flex", alignItems: "center" }}>
              <SolarPower sx={{ mr: 0.8, fontSize: 18 }} />
              Quotation Builder
            </Typography>
            <Box sx={{ display: "flex", gap: 0.8, alignItems: "center", flexWrap: "wrap" }}>
              <Link href="/admin" style={{ textDecoration: 'none' }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AdminPanelSettings sx={{ fontSize: 13 }} />}
                  sx={{
                    color: "white",
                    borderColor: "rgba(255,255,255,0.4)",
                    "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)" },
                    textTransform: "none",
                    fontWeight: "bold",
                    px: 1.2,
                    py: 0.2,
                    fontSize: 11
                  }}
                >
                  Admin
                </Button>
              </Link>

              {mounted && user ? (
                role === 'super_admin' ? (
                  /* DEVELOPER / SUPER ADMIN CONTROLS */
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                    <Link href="/admin/vendors" style={{ textDecoration: 'none' }}>
                      <Button
                        variant="contained"
                        size="small"
                        sx={{ bgcolor: "#0f172a", '&:hover': { bgcolor: '#1e293b' }, textTransform: 'none', fontWeight: 700, px: 1, py: 0.2, fontSize: 10.5 }}
                      >
                        Vendors
                      </Button>
                    </Link>
                    <Link href="/admin/quotations" style={{ textDecoration: 'none' }}>
                      <Button
                        variant="outlined"
                        size="small"
                        sx={{ color: "white", borderColor: "rgba(255,255,255,0.4)", textTransform: 'none', fontWeight: 600, px: 1, py: 0.2, fontSize: 10.5 }}
                      >
                        All Quotes
                      </Button>
                    </Link>
                    <IconButton
                      size="small"
                      title="Sign Out"
                      onClick={() => signOut()}
                      sx={{ color: "rgba(255,255,255,0.7)", p: 0.5, "&:hover": { color: "#fff" } }}
                    >
                      <Logout sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Box>
                ) : (
                  /* VENDOR WORKSPACE CONTROLS */
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                    <Chip
                      icon={<Storefront sx={{ fontSize: "14px !important", color: "#ff9800 !important" }} />}
                      label={vendor?.name || 'My Shop'}
                      size="small"
                      sx={{ bgcolor: "rgba(255,152,0,0.2)", color: "#ff9800", fontWeight: 700, fontSize: 10.5, height: 24 }}
                    />
                    <Link href="/vendor/profile" style={{ textDecoration: 'none' }}>
                      <Button
                        variant="outlined"
                        size="small"
                        sx={{ color: "white", borderColor: "rgba(255,255,255,0.4)", textTransform: 'none', fontWeight: 600, px: 1, py: 0.2, fontSize: 10.5 }}
                      >
                        Shop Profile
                      </Button>
                    </Link>
                    <Link href="/admin/quotations" style={{ textDecoration: 'none' }}>
                      <Button
                        variant="outlined"
                        size="small"
                        sx={{ color: "white", borderColor: "rgba(255,255,255,0.4)", textTransform: 'none', fontWeight: 600, px: 1, py: 0.2, fontSize: 10.5 }}
                      >
                        My Quotes
                      </Button>
                    </Link>
                    <IconButton
                      size="small"
                      title="Sign Out"
                      onClick={() => signOut()}
                      sx={{ color: "rgba(255,255,255,0.7)", p: 0.5, "&:hover": { color: "#fff" } }}
                    >
                      <Logout sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Box>
                )
              ) : (
                /* GUEST / OFFLINE CONTROLS */
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                  <Link href="/vendor/profile" style={{ textDecoration: 'none' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      sx={{
                        color: "white",
                        borderColor: "rgba(255,255,255,0.4)",
                        "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)" },
                        textTransform: "none",
                        fontWeight: 600,
                        px: 1,
                        py: 0.2,
                        fontSize: 10.5
                      }}
                    >
                      Shop Profile
                    </Button>
                  </Link>
                  <Link href="/login" style={{ textDecoration: 'none' }}>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<LoginIcon sx={{ fontSize: 13 }} />}
                      sx={{
                        bgcolor: "#ff9800",
                        "&:hover": { bgcolor: "#f57c00" },
                        textTransform: "none",
                        fontWeight: 800,
                        px: 1.2,
                        py: 0.2,
                        fontSize: 10.5
                      }}
                    >
                      Sign In
                    </Button>
                  </Link>
                </Box>
              )}
            </Box>
          </Box>
        </Box>

        {/* Editing Banner */}
        {editingQuotationId && (
          <Box sx={{ p: 1.5, bgcolor: "#2563eb", color: "white", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="body2" fontWeight="bold" sx={{ fontSize: 12 }}>
              ✏️ Editing: {customerName || "Quotation"}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={handleReset}
              sx={{ color: "white", borderColor: "rgba(255,255,255,0.5)", fontSize: 10, py: 0, "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)" } }}
            >
              Cancel Edit
            </Button>
          </Box>
        )}

        {/* Scrollable Form */}
        <Box sx={{ flex: 1, overflow: "auto", p: 0 }}>
          {/* Company / Vendor Selection */}
          <Box sx={{ p: 2, borderBottom: "1px solid #e2e8f0", bgcolor: "#f8fafc" }}>
            {mounted && role !== 'super_admin' ? (
              <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: 'rgba(255, 152, 0, 0.08)', border: '1px solid rgba(255, 152, 0, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Storefront sx={{ color: '#ff9800', fontSize: 20 }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e293b', fontSize: 12 }}>
                      {activeCompany.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', fontSize: 10.5 }}>
                      Signatory: {activeCompany.authorizedSignatory}
                    </Typography>
                  </Box>
                </Box>
                <Chip label="Your Shop" size="small" sx={{ bgcolor: '#ff9800', color: '#fff', fontWeight: 700, fontSize: 10, height: 20 }} />
              </Box>
            ) : (
              <FormControl fullWidth size="small">
                <InputLabel id="active-vendor-sim-label">Active Vendor Simulator</InputLabel>
                <Select
                  labelId="active-vendor-sim-label"
                  value={effectiveCompanyId}
                  label="Active Vendor Simulator"
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedCompanyId(newId);
                    const found = allVendors.find(v => v.id === newId);
                    if (found) switchVendor(found);
                  }}
                >
                  {(allVendors && allVendors.length > 0 ? allVendors : companies).map((v: any) => {
                    const signatory = v.authorized_signatory || v.authorizedSignatory;
                    const displayLabel = signatory ? `${v.name} (${signatory})` : v.name;
                    return (
                      <MenuItem key={v.id} value={v.id}>
                        {displayLabel}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            )}
          </Box>

          {/* System Type */}
          <Accordion defaultExpanded disableGutters sx={{ boxShadow: "none", "&:before": { display: "none" } }}>
            <AccordionSummary expandIcon={<ExpandMore />} sx={{ bgcolor: "#f8fafc", minHeight: 44, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
              <SolarPower sx={{ mr: 1, color: "#1e3a5f", fontSize: 18 }} />
              <Typography variant="subtitle2" fontWeight="bold" color="#1e3a5f">System Type</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 1.5 }}>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {systemTypes.map((type) => (
                  <Chip
                    key={type.id}
                    label={type.name}
                    icon={type.icon}
                    onClick={() => setSelectedSystemType(type.id)}
                    variant={selectedSystemType === type.id ? "filled" : "outlined"}
                    sx={{ bgcolor: selectedSystemType === type.id ? type.color : "transparent", color: selectedSystemType === type.id ? "white" : "inherit", "& .MuiChip-icon": { color: selectedSystemType === type.id ? "white" : type.color } }}
                  />
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* ===== B2B / APOLLO STRUCTURE MODE FORM ===== */}
          {isB2BMode && (<>
            {/* Client & Business Details */}
            <Accordion defaultExpanded disableGutters sx={{ boxShadow: "none", "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMore />} sx={{ bgcolor: "#f8fafc", minHeight: 44, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                <Person sx={{ mr: 1, color: "#d97706", fontSize: 18 }} />
                <Typography variant="subtitle2" fontWeight="bold" color="#d97706">Client & Business Details</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
                <TextField fullWidth label="Client / Company Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required size="small" placeholder="e.g. Apex Solar EPC Ltd" />
                <Box sx={{ display: "flex", gap: 1 }}>
                  <TextField fullWidth label="Contact Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} size="small" placeholder="10-digit mobile" />
                  <TextField fullWidth label="Buyer GSTIN" value={b2bClientGstin} onChange={(e) => setB2bClientGstin(e.target.value.toUpperCase())} size="small" placeholder="09AAAAA0000A1Z5" />
                </Box>
                <TextField fullWidth label="Billing & Delivery Address" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} size="small" multiline rows={2} placeholder="Warehouse / Site Address" />
                <TextField fullWidth label="Proposal Title" value={b2bProposalTitle} onChange={(e) => setB2bProposalTitle(e.target.value)} size="small" />

                {/* Make Selector & Branding */}
                <Box sx={{ p: 1.5, bgcolor: "#fffbeb", borderRadius: 1.5, border: "1px solid #fde68a" }}>
                  <Typography variant="caption" fontWeight="bold" color="#92400e" sx={{ display: "block", mb: 0.5 }}>
                    STRUCTURE MAKE / SPECIFICATION:
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                    {(["APOLLO", "TATA", "APOLLO / TATA"] as const).map((make) => (
                      <Chip
                        key={make}
                        label={make}
                        size="small"
                        onClick={() => {
                          setB2bStructureMake(make);
                          setB2bTerms((prev) =>
                            prev.map((t) =>
                              t.startsWith("Make & Material:")
                                ? `Make & Material: Structure Make ${make} (Hot-dip / pre-galvanised 80+ micron steel conforming to MNRE standards).`
                                : t
                            )
                          );
                        }}
                        color={b2bStructureMake === make ? "warning" : "default"}
                        variant={b2bStructureMake === make ? "filled" : "outlined"}
                        sx={{ fontWeight: "bold" }}
                      />
                    ))}
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Verified sx={{ fontSize: 14, color: "#16a34a" }} />
                    <Typography variant="caption" sx={{ color: "#166534", fontWeight: 700 }}>
                      AVAILABLE AT BEST RATE • MNRE STANDARD COMPLIANT
                    </Typography>
                  </Box>
                </Box>
              </AccordionDetails>
            </Accordion>

            {/* Quick Product Catalog Picker */}
            <Accordion defaultExpanded disableGutters sx={{ boxShadow: "none", "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMore />} sx={{ bgcolor: "#f8fafc", minHeight: 44, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                <Factory sx={{ mr: 1, color: "#d97706", fontSize: 18 }} />
                <Typography variant="subtitle2" fontWeight="bold" color="#d97706">
                  Add from Catalog ({filteredB2BCatalog.length} Available)
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 1.5 }}>
                {/* Search Bar & Sync Button */}
                <Box sx={{ display: "flex", gap: 1, mb: 1.5, alignItems: "center" }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search products or SKU..."
                    value={b2bSearchQuery}
                    onChange={(e) => setB2bSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16 }} /></InputAdornment>,
                    }}
                  />
                  <Tooltip title="Refresh latest rates from Admin">
                    <IconButton
                      size="small"
                      onClick={() => {
                        fetchB2BCatalog();
                        setNotification({ open: true, message: "Synced latest rates from admin", severity: "info" });
                      }}
                      sx={{
                        bgcolor: "#fef3c7",
                        color: "#d97706",
                        p: 0.75,
                        border: "1px solid #fde68a",
                        "&:hover": { bgcolor: "#fde68a" },
                        flexShrink: 0,
                      }}
                    >
                      <RestartAlt sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                </Box>

                {/* Category Chips Filter */}
                <Box sx={{ display: "flex", gap: 0.5, overflowX: "auto", pb: 1, mb: 1.5, "&::-webkit-scrollbar": { height: 4 } }}>
                  {apolloCategories.map((cat) => (
                    <Chip
                      key={cat}
                      label={cat}
                      size="small"
                      clickable
                      onClick={() => setB2bSelectedCat(cat)}
                      variant={b2bSelectedCat === cat ? "filled" : "outlined"}
                      sx={{
                        fontSize: 10,
                        height: 24,
                        bgcolor: b2bSelectedCat === cat ? "#d97706" : "transparent",
                        color: b2bSelectedCat === cat ? "white" : "inherit",
                        flexShrink: 0,
                      }}
                    />
                  ))}
                </Box>

                {/* Catalog Product Cards (Scrollable) */}
                <Box sx={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1, pr: 0.5 }}>
                  {filteredB2BCatalog.map((prod) => {
                    const inQuoteItem = b2bItems.find(it => it.sku === prod.sku);
                    return (
                      <Box
                        key={prod.id}
                        sx={{
                          p: 1,
                          borderRadius: 1,
                          border: inQuoteItem ? "1.5px solid #f59e0b" : "1px solid #e2e8f0",
                          bgcolor: inQuoteItem ? "#fffdf5" : "white",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 1,
                        }}
                      >
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="body2" fontWeight="bold" sx={{ fontSize: "12px", lineHeight: 1.2 }}>
                            {prod.name}
                          </Typography>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.25, flexWrap: "wrap" }}>
                            <Typography variant="caption" sx={{ fontFamily: "monospace", color: "#64748b", fontSize: "10px" }}>
                              {prod.sku}
                            </Typography>
                            <Chip label={prod.unit} size="small" sx={{ height: 18, fontSize: 9 }} />
                            <Chip
                              label={`${prod.gstRate ?? 18}% GST`}
                              size="small"
                              color={prod.gstRate === 5 ? "success" : "default"}
                              variant={prod.gstRate === 5 ? "filled" : "outlined"}
                              sx={{ height: 18, fontSize: 8.5, fontWeight: prod.gstRate === 5 ? "bold" : "normal" }}
                            />
                            <Typography variant="caption" fontWeight="bold" color="#b45309">
                              {prod.basePrice > 0 ? `₹${formatCurrency(prod.basePrice)}` : "₹0 (Custom)"}
                            </Typography>
                          </Box>
                        </Box>
                        <Button
                          size="small"
                          variant={inQuoteItem ? "contained" : "outlined"}
                          color="warning"
                          onClick={() => addB2BItem(prod)}
                          startIcon={<Add sx={{ fontSize: 14 }} />}
                          sx={{ fontSize: 11, py: 0.2, px: 1, minWidth: 0, flexShrink: 0 }}
                        >
                          {inQuoteItem ? `Added (${inQuoteItem.qty})` : "Add"}
                        </Button>
                      </Box>
                    );
                  })}
                </Box>
              </AccordionDetails>
            </Accordion>

            {/* Active Quotation Items Table */}
            <Accordion defaultExpanded disableGutters sx={{ boxShadow: "none", "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMore />} sx={{ bgcolor: "#f8fafc", minHeight: 44, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                <ListAlt sx={{ mr: 1, color: "#d97706", fontSize: 18 }} />
                <Typography variant="subtitle2" fontWeight="bold" color="#d97706">
                  Quotation Line Items ({b2bItems.length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 1 }}>
                {b2bItems.length === 0 ? (
                  <Typography variant="caption" color="text.secondary" sx={{ p: 2, display: "block", textAlign: "center" }}>
                    No items in quotation. Select from the catalog above or add custom item!
                  </Typography>
                ) : (
                  b2bItems.map((item, idx) => (
                    <Box key={item.id} sx={{ p: 1, mb: 1, bgcolor: idx % 2 === 0 ? "#f8fafc" : "white", borderRadius: 1, border: "1px solid #e2e8f0" }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 0.5 }}>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="caption" fontWeight="bold" sx={{ color: "#0f172a" }}>
                            {idx + 1}. {item.name}
                          </Typography>
                          <Typography variant="caption" sx={{ display: "block", color: "#64748b", fontFamily: "monospace", fontSize: 10 }}>
                            {item.sku} • {item.category}
                          </Typography>
                        </Box>
                        <IconButton size="small" color="error" onClick={() => removeB2BItem(idx)}>
                          <Delete sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Box>
                      <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
                        <TextField
                          label="Rate (₹)"
                          type="number"
                          value={item.basePrice}
                          onChange={(e) => updateB2BItem(idx, "basePrice", e.target.value)}
                          size="small"
                          InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                          sx={{ flex: 1.2 }}
                        />
                        <TextField
                          label="Qty"
                          type="number"
                          value={item.qty}
                          onChange={(e) => updateB2BItem(idx, "qty", e.target.value)}
                          size="small"
                          sx={{ width: 55 }}
                        />
                        <FormControl size="small" sx={{ width: 72 }}>
                          <InputLabel sx={{ fontSize: "11px" }}>GST</InputLabel>
                          <Select
                            value={item.gstRate !== undefined ? item.gstRate : 18}
                            label="GST"
                            onChange={(e) => updateB2BItem(idx, "gstRate", Number(e.target.value))}
                            sx={{ height: 40, fontSize: "11px", fontWeight: "bold", color: item.gstRate === 5 ? "#059669" : "inherit" }}
                          >
                            <MenuItem value={18} sx={{ fontSize: "11px" }}>18%</MenuItem>
                            <MenuItem value={5} sx={{ fontSize: "11px", color: "#059669", fontWeight: "bold" }}>5%</MenuItem>
                            <MenuItem value={12} sx={{ fontSize: "11px" }}>12%</MenuItem>
                            <MenuItem value={0} sx={{ fontSize: "11px" }}>0%</MenuItem>
                          </Select>
                        </FormControl>
                        <Chip label={item.unit} size="small" sx={{ height: 24, fontSize: 9 }} />
                        <Box sx={{ textAlign: "right", minWidth: 65 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>Line Total</Typography>
                          <Typography variant="body2" fontWeight="bold" color="#b45309" sx={{ fontSize: "11.5px" }}>
                            ₹{formatCurrency(item.amount)}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  ))
                )}
                <Button
                  fullWidth
                  variant="outlined"
                  size="small"
                  color="warning"
                  startIcon={<Add />}
                  onClick={() => setAddB2BCustomDialog(true)}
                  sx={{ mt: 1 }}
                >
                  Add Custom Item
                </Button>
              </AccordionDetails>
            </Accordion>

            {/* Commercial Terms & Dispatch */}
            <Accordion disableGutters sx={{ boxShadow: "none", "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMore />} sx={{ bgcolor: "#f8fafc", minHeight: 44, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                <Settings sx={{ mr: 1, color: "#d97706", fontSize: 18 }} />
                <Typography variant="subtitle2" fontWeight="bold" color="#d97706">Dispatch & Commercial Terms</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
                <TextField fullWidth label="Dispatch Location" value={b2bDispatchLocation} onChange={(e) => setB2bDispatchLocation(e.target.value)} size="small" />
                <TextField fullWidth label="Payment Terms" value={b2bPaymentTerms} onChange={(e) => setB2bPaymentTerms(e.target.value)} size="small" />
                <Box sx={{ display: "flex", gap: 1 }}>
                  <TextField fullWidth label="Delivery Timeline" value={b2bDeliveryDays} onChange={(e) => setB2bDeliveryDays(e.target.value)} size="small" />
                  <TextField label="Validity (Days)" type="number" value={b2bValidDays} onChange={(e) => setB2bValidDays(parseInt(e.target.value) || 7)} size="small" sx={{ width: 100 }} />
                </Box>
                <Typography variant="caption" fontWeight="bold" sx={{ mt: 0.5, color: "#92400e" }}>
                  Detailed Terms & Conditions ({b2bTerms.length}):
                </Typography>
                {b2bTerms.map((t, i) => (
                  <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 0.5, p: 0.5, bgcolor: i % 2 === 0 ? "#f8fafc" : "white", borderRadius: 1 }}>
                    {editB2BTermIdx === i ? (
                      <TextField fullWidth value={editB2BTermText} onChange={(e) => setEditB2BTermText(e.target.value)} size="small" multiline onBlur={() => { const u = [...b2bTerms]; u[i] = editB2BTermText; setB2bTerms(u); setEditB2BTermIdx(-1); }} autoFocus />
                    ) : (
                      <Typography variant="caption" sx={{ flex: 1, cursor: "pointer" }} onClick={() => { setEditB2BTermIdx(i); setEditB2BTermText(t); }}>
                        {i + 1}. {t.substring(0, 75)}...
                      </Typography>
                    )}
                    <IconButton size="small" onClick={() => { setEditB2BTermIdx(i); setEditB2BTermText(t); }}><Edit sx={{ fontSize: 14 }} /></IconButton>
                    <IconButton size="small" color="error" onClick={() => setB2bTerms(b2bTerms.filter((_, idx) => idx !== i))}><Delete sx={{ fontSize: 14 }} /></IconButton>
                  </Box>
                ))}
                <Button fullWidth variant="outlined" size="small" startIcon={<Add />} onClick={() => setB2bTerms([...b2bTerms, "New commercial term"])}>Add Term</Button>
              </AccordionDetails>
            </Accordion>

            {/* B2B Pricing Summary */}
            <Accordion defaultExpanded disableGutters sx={{ boxShadow: "none", "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMore />} sx={{ bgcolor: "#f8fafc", minHeight: 44, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                <AttachMoney sx={{ mr: 1, color: "#d97706", fontSize: 18 }} />
                <Typography variant="subtitle2" fontWeight="bold" color="#d97706">Pricing Summary</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="body2" color="text.secondary">Taxable Subtotal:</Typography>
                  <Typography variant="body2" fontWeight="bold">₹ {formatCurrency(b2bSubtotal)}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="body2" color="text.secondary">{b2bGstLabel.replace(':', '')}:</Typography>
                  <Typography variant="body2" fontWeight="bold">₹ {formatCurrency(b2bGstAmount)}</Typography>
                </Box>
                <Box sx={{ p: 1.5, bgcolor: "#fef3c7", borderRadius: 1.5, textAlign: "center", border: "1px solid #fcd34d", mt: 0.5 }}>
                  <Typography variant="caption" sx={{ color: "#92400e", textTransform: "uppercase", fontWeight: 800, letterSpacing: 0.5 }}>Grand Total (Incl. GST)</Typography>
                  <Typography variant="h5" fontWeight="900" color="#b45309">₹ {formatCurrency(b2bGrandTotal)}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: 10, mt: 0.5 }}>
                    {numberToWordsINR(b2bGrandTotal)}
                  </Typography>
                </Box>
              </AccordionDetails>
            </Accordion>
          </>)}

          {/* ===== SERVICE MODE FORM ===== */}
          {isServiceMode && !isB2BMode && (<>
            {/* Client Details */}
            <Accordion defaultExpanded disableGutters sx={{ boxShadow: "none", "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMore />} sx={{ bgcolor: "#f8fafc", minHeight: 44, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                <Person sx={{ mr: 1, color: "#0d47a1", fontSize: 18 }} />
                <Typography variant="subtitle2" fontWeight="bold" color="#0d47a1">Client Details</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
                <TextField fullWidth label="Client / Company Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required size="small" />
                <TextField fullWidth label="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} size="small" />
                <TextField fullWidth label="Address" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} size="small" multiline rows={2} />
                <TextField fullWidth label="Proposal Title" value={serviceProposalTitle} onChange={(e) => setServiceProposalTitle(e.target.value)} size="small" />
              </AccordionDetails>
            </Accordion>

            {/* Service Items */}
            <Accordion defaultExpanded disableGutters sx={{ boxShadow: "none", "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMore />} sx={{ bgcolor: "#f8fafc", minHeight: 44, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                <ListAlt sx={{ mr: 1, color: "#0d47a1", fontSize: 18 }} />
                <Typography variant="subtitle2" fontWeight="bold" color="#0d47a1">Service Items ({serviceItems.length})</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 1 }}>
                {serviceItems.map((item, i) => (
                  <Box key={i} sx={{ p: 1, mb: 1, bgcolor: i % 2 === 0 ? "#f8fafc" : "white", borderRadius: 1, border: "1px solid #e2e8f0" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                      <Typography variant="caption" fontWeight="bold">Item {i + 1}</Typography>
                      <IconButton size="small" color="error" onClick={() => setServiceItems(serviceItems.filter((_, idx) => idx !== i).map((it, idx) => ({ ...it, sno: idx + 1 })))}><Delete sx={{ fontSize: 16 }} /></IconButton>
                    </Box>
                    <TextField fullWidth label="Description" value={item.description} onChange={(e) => updateServiceItem(i, "description", e.target.value)} size="small" sx={{ mb: 1 }} multiline />
                    <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                      <TextField label="HSN/SAC" value={item.hsnSac} onChange={(e) => updateServiceItem(i, "hsnSac", e.target.value)} size="small" sx={{ flex: 1 }} />
                      <TextField label="Qty" value={item.qty} onChange={(e) => updateServiceItem(i, "qty", e.target.value)} size="small" sx={{ width: 60 }} />
                      <FormControl size="small" sx={{ width: 90 }}>
                        <InputLabel>Unit</InputLabel>
                        <Select value={item.unit} label="Unit" onChange={(e) => updateServiceItem(i, "unit", e.target.value)}>
                          <MenuItem value="Year">Year</MenuItem>
                          <MenuItem value="Month">Month</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                    <TextField fullWidth label={item.unit === "Month" ? "Monthly Rate (₹)" : "Yearly Rate (₹)"} type="number" value={item.rate} onChange={(e) => updateServiceItem(i, "rate", parseFloat(e.target.value) || 0)} InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} size="small" />
                    {item.unit === "Month" ? (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>Yearly Total: ₹{formatCurrency(item.amount)}</Typography>
                    ) : item.monthlyRate ? (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>Monthly: ₹{formatCurrency(item.monthlyRate)}</Typography>
                    ) : null}
                  </Box>
                ))}
                <Button fullWidth variant="outlined" size="small" startIcon={<Add />} onClick={() => setServiceItems([...serviceItems, { sno: serviceItems.length + 1, description: "", hsnSac: "998717", qty: "1", unit: "Year", rate: 0, amount: 0, monthlyRate: 0 }])} sx={{ mt: 1 }}>Add Service Item</Button>
              </AccordionDetails>
            </Accordion>

            {/* Service Pricing */}
            <Accordion defaultExpanded disableGutters sx={{ boxShadow: "none", "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMore />} sx={{ bgcolor: "#f8fafc", minHeight: 44, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                <AttachMoney sx={{ mr: 1, color: "#0d47a1", fontSize: 18 }} />
                <Typography variant="subtitle2" fontWeight="bold" color="#0d47a1">Pricing</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
                <TextField label="GST Rate" type="number" value={serviceGst} onChange={(e) => setServiceGst(parseFloat(e.target.value) || 0)} InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} size="small" />
                <Box sx={{ p: 1.5, bgcolor: "#e3f2fd", borderRadius: 1, textAlign: "center" }}>
                  <Typography variant="caption" sx={{ color: "#0d47a1", textTransform: "uppercase", fontWeight: 700 }}>Grand Total</Typography>
                  <Typography variant="h5" fontWeight="900" color="#1b5e20">₹ {formatCurrency(serviceGrandTotal)}</Typography>
                </Box>
              </AccordionDetails>
            </Accordion>

            {/* Service Terms */}
            <Accordion disableGutters sx={{ boxShadow: "none", "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMore />} sx={{ bgcolor: "#f8fafc", minHeight: 44, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                <ListAlt sx={{ mr: 1, color: "#0d47a1", fontSize: 18 }} />
                <Typography variant="subtitle2" fontWeight="bold" color="#0d47a1">Terms ({serviceTerms.length})</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 1 }}>
                {serviceTerms.map((t, i) => (
                  <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 0.5, p: 0.5, bgcolor: i % 2 === 0 ? "#f8fafc" : "white", borderRadius: 1, mb: 0.5 }}>
                    {editTermIdx === i ? (
                      <TextField fullWidth value={editTermText} onChange={(e) => setEditTermText(e.target.value)} size="small" multiline onBlur={() => { const u = [...serviceTerms]; u[i] = editTermText; setServiceTerms(u); setEditTermIdx(-1); }} autoFocus />
                    ) : (
                      <Typography variant="caption" sx={{ flex: 1, cursor: "pointer" }} onClick={() => { setEditTermIdx(i); setEditTermText(t); }}>{i + 1}. {t.substring(0, 80)}...</Typography>
                    )}
                    <IconButton size="small" onClick={() => { setEditTermIdx(i); setEditTermText(t); }}><Edit sx={{ fontSize: 14 }} /></IconButton>
                    <IconButton size="small" color="error" onClick={() => setServiceTerms(serviceTerms.filter((_, idx) => idx !== i))}><Delete sx={{ fontSize: 14 }} /></IconButton>
                  </Box>
                ))}
                <Button fullWidth variant="outlined" size="small" startIcon={<Add />} onClick={() => setServiceTerms([...serviceTerms, "New term"])} sx={{ mt: 1 }}>Add Term</Button>
              </AccordionDetails>
            </Accordion>
          </>)}

          {/* ===== SOLAR MODE FORM ===== */}
          {!isServiceMode && !isB2BMode && (<>
            {/* Customer Details */}
            <Accordion defaultExpanded disableGutters sx={{ boxShadow: "none", "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMore />} sx={{ bgcolor: "#f8fafc", minHeight: 44, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                <Person sx={{ mr: 1, color: "#1e3a5f", fontSize: 18 }} />
                <Typography variant="subtitle2" fontWeight="bold" color="#1e3a5f">Customer Details</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
                <TextField fullWidth label="Customer Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required size="small" />
                <TextField fullWidth label="Mobile Number" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} size="small" />
                <TextField fullWidth label="Address" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} size="small" multiline rows={2} />
              </AccordionDetails>
            </Accordion>

            {/* System Configuration */}
            <Accordion defaultExpanded disableGutters sx={{ boxShadow: "none", "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMore />} sx={{ bgcolor: "#f8fafc", minHeight: 44, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                <Settings sx={{ mr: 1, color: "#1e3a5f", fontSize: 18 }} />
                <Typography variant="subtitle2" fontWeight="bold" color="#1e3a5f">System Configuration</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <TextField label="Capacity (KW)" type="number" value={capacityKw} onChange={(e) => setCapacityKw(e.target.value === "" ? 0 : parseFloat(e.target.value))} inputProps={{ step: 0.1, min: 0 }} size="small" sx={{ flex: 1 }} />
                  <TextField label="Wattage (Wp)" type="number" value={panelWattage} onChange={(e) => setPanelWattage(e.target.value === "" ? 0 : parseInt(e.target.value))} inputProps={{ step: 5, min: 0 }} size="small" sx={{ flex: 1 }} />
                </Box>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <TextField label="Panels" value={numberOfPanels} InputProps={{ readOnly: true }} size="small" sx={{ flex: 1, "& input": { fontWeight: "bold", color: "#1e3a5f" } }} />
                  <TextField label="Actual (KW)" value={actualSystemSize} InputProps={{ readOnly: true }} size="small" sx={{ flex: 1, "& input": { fontWeight: "bold", color: "#1e3a5f" } }} />
                </Box>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel>Brand</InputLabel>
                    <Select value={panelBrand} label="Brand" onChange={(e) => setPanelBrand(e.target.value)}>
                      {panelBrands.map((b) => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel>Type</InputLabel>
                    <Select value={panelType} label="Type" onChange={(e) => setPanelType(e.target.value)}>
                      {panelTypes.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Box>
                {panelBrand === "Other" && <TextField fullWidth label="Custom Brand" value={customPanelBrand} onChange={(e) => setCustomPanelBrand(e.target.value)} size="small" />}
                <Box sx={{ display: "flex", gap: 1 }}>
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel>Inverter</InputLabel>
                    <Select value={inverterBrand} label="Inverter" onChange={(e) => setInverterBrand(e.target.value)}>
                      {inverterBrands.map((b) => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel>Phase</InputLabel>
                    <Select value={phase} label="Phase" onChange={(e) => setPhase(Number(e.target.value))}>
                      <MenuItem value={1}>1Φ</MenuItem>
                      <MenuItem value={3}>3Φ</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                {inverterBrand === "Other" && <TextField fullWidth label="Custom Inverter Brand" value={customInverterBrand} onChange={(e) => setCustomInverterBrand(e.target.value)} size="small" />}

                <TextField
                  fullWidth
                  label="Inverter Model (Wattage/Capacity)"
                  value={inverterModel}
                  onChange={(e) => {
                    setInverterModel(e.target.value);
                    setInverterModelEdited(true); // Mark as manually edited
                  }}
                  size="small"
                  placeholder="e.g., 5 KW On-Grid String"
                />

                <Box sx={{ display: "flex", gap: 1 }}>
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel>Panel Warranty</InputLabel>
                    <Select value={panelWarranty} label="Panel Warranty" onChange={(e) => setPanelWarranty(e.target.value)}>
                      <MenuItem value="25 Years">25 Years</MenuItem>
                      <MenuItem value="30 Years">30 Years</MenuItem>
                      <MenuItem value="10 Years">10 Years</MenuItem>
                      <MenuItem value="12 Years">12 Years</MenuItem>
                      <MenuItem value="Other">Other</MenuItem>
                    </Select>
                  </FormControl>
                  {panelWarranty === "Other" && <TextField label="Custom Panel Warranty" size="small" sx={{ flex: 1 }} onChange={(e) => setPanelWarranty(e.target.value)} />}

                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel>Inverter Warranty</InputLabel>
                    <Select value={inverterWarranty} label="Inverter Warranty" onChange={(e) => setInverterWarranty(e.target.value)}>
                      <MenuItem value="5 Years">5 Years</MenuItem>
                      <MenuItem value="7 Years">7 Years</MenuItem>
                      <MenuItem value="8 Years">8 Years</MenuItem>
                      <MenuItem value="10 Years">10 Years</MenuItem>
                      <MenuItem value="Other">Other</MenuItem>
                    </Select>
                  </FormControl>
                  {inverterWarranty === "Other" && <TextField label="Custom Inverter Warranty" size="small" sx={{ flex: 1 }} onChange={(e) => setInverterWarranty(e.target.value)} />}
                </Box>

                {(selectedSystemType === "Hybrid" || selectedSystemType === "Off-grid") && (
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <FormControl size="small" sx={{ flex: 1 }}>
                      <InputLabel>Battery Warranty</InputLabel>
                      <Select value={batteryWarranty} label="Battery Warranty" onChange={(e) => setBatteryWarranty(e.target.value)}>
                        <MenuItem value="1 Year">1 Year</MenuItem>
                        <MenuItem value="2 Years">2 Years</MenuItem>
                        <MenuItem value="3 Years">3 Years</MenuItem>
                        <MenuItem value="4 Years">4 Years</MenuItem>
                        <MenuItem value="5 Years">5 Years</MenuItem>
                        <MenuItem value="6 Years">6 Years</MenuItem>
                        <MenuItem value="7 Years">7 Years</MenuItem>
                        <MenuItem value="8 Years">8 Years</MenuItem>
                        <MenuItem value="10 Years">10 Years</MenuItem>
                        <MenuItem value="12 Years">12 Years</MenuItem>
                        <MenuItem value="Other">Other (Custom)</MenuItem>
                      </Select>
                    </FormControl>
                    {batteryWarranty === "Other" && (
                      <TextField
                        label="Custom Battery Warranty"
                        size="small"
                        sx={{ flex: 1 }}
                        placeholder="e.g. 15 Years"
                        value={customBatteryWarranty}
                        onChange={(e) => setCustomBatteryWarranty(e.target.value)}
                      />
                    )}
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>

            {/* Pricing */}
            <Accordion defaultExpanded disableGutters sx={{ boxShadow: "none", "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMore />} sx={{ bgcolor: "#f8fafc", minHeight: 44, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                <AttachMoney sx={{ mr: 1, color: "#1e3a5f", fontSize: 18 }} />
                <Typography variant="subtitle2" fontWeight="bold" color="#1e3a5f">Pricing</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
                <TextField fullWidth label="System Price (Incl. GST)" type="number" value={priceInput} onChange={(e) => setPriceInput(e.target.value === "" ? 0 : parseFloat(e.target.value))} InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} size="small" />
                <Box sx={{ display: "flex", gap: 1 }}>
                  <TextField label="GST Rate" type="number" value={gstRate} onChange={(e) => setGstRate(e.target.value === "" ? 0 : parseFloat(e.target.value))} InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} size="small" sx={{ flex: 1 }} />
                  <TextField label="GST Amount" value={`₹ ${formatCurrency(calculations.gstAmount)}`} InputProps={{ readOnly: true }} size="small" sx={{ flex: 1 }} />
                </Box>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <TextField label="Central Subsidy" type="number" value={centralSubsidy} onChange={(e) => setCentralSubsidy(e.target.value === "" ? 0 : parseFloat(e.target.value))} InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} size="small" sx={{ flex: 1 }} />
                  <TextField label="State Subsidy" type="number" value={stateSubsidy} onChange={(e) => setStateSubsidy(e.target.value === "" ? 0 : parseFloat(e.target.value))} InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} size="small" sx={{ flex: 1 }} />
                </Box>
                <Box sx={{ p: 1.5, bgcolor: "#dbeafe", borderRadius: 1, textAlign: "center" }}>
                  <Typography variant="caption" sx={{ color: "#1e40af", textTransform: "uppercase", fontWeight: 700 }}>Effective Cost</Typography>
                  <Typography variant="h5" fontWeight="900" color="#16a34a">₹ {formatCurrency(calculations.effectiveCost)}</Typography>
                </Box>
              </AccordionDetails>
            </Accordion>

            {/* Extra Costs (Optional) */}
            <Accordion disableGutters sx={{ boxShadow: "none", "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMore />} sx={{ bgcolor: "#fef3c7", minHeight: 44, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                <AddCircle sx={{ mr: 1, color: "#d97706", fontSize: 18 }} />
                <Typography variant="subtitle2" fontWeight="bold" color="#92400e">
                  Extra Costs {extraCosts.total > 0 && <Chip size="small" label={`₹${formatCurrency(extraCosts.total)}`} sx={{ ml: 1, height: 18, bgcolor: "#fbbf24", color: "#78350f", fontSize: "10px" }} />}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
                {/* Extra Structure Cost */}
                <Box sx={{ p: 1.5, bgcolor: extraStructureEnabled ? "#fef3c7" : "#f8fafc", borderRadius: 1, border: "1px solid #e2e8f0" }}>
                  <FormControlLabel
                    control={<Checkbox size="small" checked={extraStructureEnabled} onChange={(e) => setExtraStructureEnabled(e.target.checked)} />}
                    label={<Typography variant="body2" fontWeight="bold">Extra Structure Cost</Typography>}
                  />
                  {extraStructureEnabled && (
                    <Box sx={{ display: "flex", gap: 1, mt: 1, alignItems: "center" }}>
                      <TextField label="Rate/Watt" type="number" value={extraStructureRate} onChange={(e) => setExtraStructureRate(e.target.value === "" ? 0 : parseFloat(e.target.value))} InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} size="small" sx={{ width: 100 }} />
                      <Typography variant="caption" color="text.secondary">× {actualSystemSize * 1000}W =</Typography>
                      <Typography variant="body2" fontWeight="bold" color="#d97706">₹{formatCurrency(extraCosts.structureCost)}</Typography>
                    </Box>
                  )}
                </Box>

                {/* Extra Panels Cost */}
                <Box sx={{ p: 1.5, bgcolor: extraPanelsEnabled ? "#fef3c7" : "#f8fafc", borderRadius: 1, border: "1px solid #e2e8f0" }}>
                  <FormControlLabel
                    control={<Checkbox size="small" checked={extraPanelsEnabled} onChange={(e) => setExtraPanelsEnabled(e.target.checked)} />}
                    label={<Typography variant="body2" fontWeight="bold">Extra Panels</Typography>}
                  />
                  {extraPanelsEnabled && (
                    <Box sx={{ display: "flex", gap: 1, mt: 1, alignItems: "center", flexWrap: "wrap" }}>
                      <TextField label="Qty" type="number" value={extraPanelCount} onChange={(e) => setExtraPanelCount(e.target.value === "" ? 0 : parseInt(e.target.value))} inputProps={{ min: 0 }} size="small" sx={{ width: 70 }} />
                      <Typography variant="caption">×</Typography>
                      <TextField label="Price/Panel" type="number" value={extraPanelPrice} onChange={(e) => setExtraPanelPrice(e.target.value === "" ? 0 : parseFloat(e.target.value))} InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} size="small" sx={{ width: 110 }} />
                      <Typography variant="caption">=</Typography>
                      <Typography variant="body2" fontWeight="bold" color="#d97706">₹{formatCurrency(extraCosts.panelsCost)}</Typography>
                    </Box>
                  )}
                </Box>

                {/* Extra Wire Cost */}
                <Box sx={{ p: 1.5, bgcolor: extraWireEnabled ? "#fef3c7" : "#f8fafc", borderRadius: 1, border: "1px solid #e2e8f0" }}>
                  <FormControlLabel
                    control={<Checkbox size="small" checked={extraWireEnabled} onChange={(e) => setExtraWireEnabled(e.target.checked)} />}
                    label={<Typography variant="body2" fontWeight="bold">Extra Wire</Typography>}
                  />
                  {extraWireEnabled && (
                    <Box sx={{ display: "flex", gap: 1, mt: 1, alignItems: "center", flexWrap: "wrap" }}>
                      <TextField label="Length (m)" type="number" value={extraWireLength} onChange={(e) => setExtraWireLength(e.target.value === "" ? 0 : parseFloat(e.target.value))} inputProps={{ min: 0 }} size="small" sx={{ width: 90 }} />
                      <Typography variant="caption">×</Typography>
                      <TextField label="Rate/m" type="number" value={extraWireRate} onChange={(e) => setExtraWireRate(e.target.value === "" ? 0 : parseFloat(e.target.value))} InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} size="small" sx={{ width: 100 }} />
                      <Typography variant="caption">=</Typography>
                      <Typography variant="body2" fontWeight="bold" color="#d97706">₹{formatCurrency(extraCosts.wireCost)}</Typography>
                    </Box>
                  )}
                </Box>

                {extraCosts.total > 0 && (
                  <Box sx={{ p: 1, bgcolor: "#fbbf24", borderRadius: 1, textAlign: "center" }}>
                    <Typography variant="caption" fontWeight="bold" color="#78350f">Total Extra: ₹{formatCurrency(extraCosts.total)}</Typography>
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>

            {/* Components */}
            <Accordion disableGutters sx={{ boxShadow: "none", "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMore />} sx={{ bgcolor: "#f8fafc", minHeight: 44, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                <ListAlt sx={{ mr: 1, color: "#1e3a5f", fontSize: 18 }} />
                <Typography variant="subtitle2" fontWeight="bold" color="#1e3a5f">Components ({components.length})</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 1 }}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  {components.map((comp, index) => (
                    <Box key={index} sx={{ display: "flex", alignItems: "center", gap: 1, p: 0.75, bgcolor: index % 2 === 0 ? "#f8fafc" : "white", borderRadius: 1, fontSize: 12 }}>
                      <Box sx={{ flex: 1, overflow: "hidden" }}>
                        <Typography variant="caption" fontWeight="bold" sx={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{comp.name}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{comp.quantity}</Typography>
                      </Box>
                      <IconButton size="small" onClick={() => handleEditComponent(index)}><Edit sx={{ fontSize: 16 }} /></IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDeleteComponent(index)}><Delete sx={{ fontSize: 16 }} /></IconButton>
                    </Box>
                  ))}
                </Box>
                <Button fullWidth variant="outlined" size="small" startIcon={<Add />} onClick={() => setAddComponentDialog(true)} sx={{ mt: 1 }}>Add Component</Button>
              </AccordionDetails>
            </Accordion>
          </>)}
        </Box>

        {/* Action Buttons */}
        <Box sx={{ p: 1.5, borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 1 }}>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Tooltip title="Generate PDF, save & print">
              <Button variant="contained" size="small" startIcon={<Print />} onClick={handlePrintWithSave} disabled={loading} sx={{ flex: 1, bgcolor: "#3b82f6", "&:hover": { bgcolor: "#2563eb" } }}>Save & Print</Button>
            </Tooltip>
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Tooltip title="Generate PDF & send via WhatsApp">
              <Button variant="contained" size="small" startIcon={<WhatsApp />} onClick={handleSendWhatsApp} disabled={loading} sx={{ flex: 1, bgcolor: "#25D366", "&:hover": { bgcolor: "#128C7E" } }}>WhatsApp</Button>
            </Tooltip>
            <Tooltip title="Generate PDF & send via Email">
              <Button variant="contained" size="small" startIcon={<Email />} onClick={handleSendEmail} disabled={loading} sx={{ flex: 1, bgcolor: "#EA4335", "&:hover": { bgcolor: "#C5221F" } }}>Email</Button>
            </Tooltip>
            <Tooltip title="Reset Form">
              <IconButton size="small" onClick={handleReset} color="error"><RestartAlt /></IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* CENTER PREVIEW */}
      <Box className="print-wrapper" sx={{ flex: 1, width: "100%", overflow: "auto", p: { xs: 2, md: 3 }, display: "flex", justifyContent: "center", bgcolor: "#e2e8f0" }}>
        <Box ref={printRef} className="print-page" sx={{ width: "210mm", minHeight: "297mm", p: "14mm 14mm 16mm 14mm", bgcolor: "white", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", fontFamily: "'Segoe UI', sans-serif", fontSize: "11px", color: "#1e293b", boxSizing: "border-box" }}>

          {/* ===== B2B / APOLLO STRUCTURE PREVIEW ===== */}
          {isB2BMode ? (<>
            {/* B2B Header */}
            <Box className="avoid-break" sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3.5px solid #d97706", pb: 1, mb: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.75 }}>
                {activeCompany.logo ? (
                  <Box component="img" src={resolveMediaUrl(activeCompany.logo)} alt="Logo" sx={{ maxHeight: 100, maxWidth: 260, objectFit: "contain" }} onError={(e: any) => { e.target.style.display = 'none'; }} />
                ) : null}
                <Box>
                  <Typography sx={{ fontSize: activeCompany.name.length > 25 ? "15px" : "20px", fontWeight: 900, color: "#b45309", letterSpacing: "-0.5px", lineHeight: 1.1, textTransform: "uppercase" }}>{activeCompany.name}</Typography>
                  <Typography sx={{ fontSize: "9.5px", fontWeight: 600, color: "#64748b", mt: 0.25, letterSpacing: 0.8, textTransform: "uppercase" }}>{activeCompany.tagline}</Typography>
                  <Box sx={{ fontSize: "8.5px", color: "#64748b", mt: 0.35 }}>
                    <Typography sx={{ color: "#b45309", fontWeight: 700, mb: 0.15, fontSize: "8.5px" }}>GSTIN: {activeCompany.gstin}{(activeCompany as any).cin ? ` | CIN: ${(activeCompany as any).cin}` : ''}</Typography>
                    <Typography sx={{ fontSize: "8.5px" }}><strong>Office:</strong> {activeCompany.headOffice}</Typography>
                    {(activeCompany as any).warehouse && <Typography sx={{ fontSize: "8.5px" }}><strong>Warehouse:</strong> {(activeCompany as any).warehouse}</Typography>}
                    <Typography sx={{ fontSize: "8.5px" }}>📞 +91 {activeCompany.phone}</Typography>
                  </Box>
                </Box>
              </Box>
              <Box sx={{ textAlign: "right" }}>
                <Box sx={{ bgcolor: "#d97706", color: "white", px: 1.5, py: 0.4, fontSize: "10px", fontWeight: 900, borderRadius: 1, mb: 0.5, textTransform: "uppercase", letterSpacing: 1 }}>
                  Commercial Quotation
                </Box>
                <Typography sx={{ fontSize: "10px", color: "#64748b", fontWeight: 700 }} suppressHydrationWarning>Date: {currentDate}</Typography>
                <Typography sx={{ fontSize: "9px", color: "#94a3b8" }}>Ref: {b2bRefNumber}</Typography>
                <Typography sx={{ fontSize: "8.5px", color: "#d97706", fontWeight: 600 }}>Valid: {b2bValidDays} Days</Typography>
              </Box>
            </Box>

            {/* Prominent Apollo Branding Banner */}
            <Box className="avoid-break" sx={{ textAlign: "center", mb: 1, py: 0.5, px: 1.25, bgcolor: "#fffbeb", borderRadius: 1.5, border: "1.5px solid #fde68a" }}>
              <Typography sx={{ fontSize: "12.5px", fontWeight: 900, color: "#92400e", textTransform: "uppercase", letterSpacing: 1.1 }}>
                {b2bProposalTitle}
              </Typography>
              <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 1, mt: 0.2, flexWrap: "wrap" }}>
                <span style={{ backgroundColor: "#d97706", color: "white", padding: "1px 6px", borderRadius: "3px", fontSize: "8px", fontWeight: 800, letterSpacing: "0.5px" }}>
                  MAKE: {b2bStructureMake}
                </span>
                <span style={{ backgroundColor: "#16a34a", color: "white", padding: "1px 6px", borderRadius: "3px", fontSize: "8px", fontWeight: 800, letterSpacing: "0.5px" }}>
                  ★ AVAILABLE AT BEST RATE ★
                </span>
              </Box>
            </Box>

            {/* Buyer & Commercial Terms Grid */}
            <Box className="avoid-break" sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.25, mb: 1 }}>
              {/* Buyer Box */}
              <Box sx={{ bgcolor: "#f8fafc", p: 1, borderRadius: 1.5, border: "1px solid #e2e8f0" }}>
                <Typography sx={{ fontWeight: 800, color: "#b45309", mb: 0.35, textTransform: "uppercase", fontSize: "8.5px", letterSpacing: 0.8, borderBottom: "1px solid #e2e8f0", pb: 0.2 }}>
                  Billed To / Consignee
                </Typography>
                <Typography sx={{ fontWeight: 900, color: "#0f172a", fontSize: "12.5px" }}>
                  {customerName || "________________"}
                </Typography>
                {customerAddress && <Typography sx={{ color: "#475569", fontWeight: 500, fontSize: "9px", mt: 0.2 }}>{customerAddress}</Typography>}
                {customerPhone && <Typography sx={{ color: "#475569", fontWeight: 600, fontSize: "9px", mt: 0.15 }}>📞 +91 {customerPhone}</Typography>}
                {b2bClientGstin && <Typography sx={{ color: "#0f172a", fontWeight: 700, fontSize: "9px", mt: 0.15 }}>GSTIN: {b2bClientGstin}</Typography>}
              </Box>

              {/* Commercial Dispatch Box */}
              <Box sx={{ bgcolor: "#f8fafc", p: 1, borderRadius: 1.5, border: "1px solid #e2e8f0" }}>
                <Typography sx={{ fontWeight: 800, color: "#b45309", mb: 0.35, textTransform: "uppercase", fontSize: "8.5px", letterSpacing: 0.8, borderBottom: "1px solid #e2e8f0", pb: 0.2 }}>
                  Dispatch & Order Conditions
                </Typography>
                <Typography sx={{ fontSize: "9px", color: "#475569", mb: 0.2 }}>
                  <strong>Dispatch:</strong> {b2bDispatchLocation}
                </Typography>
                <Typography sx={{ fontSize: "9px", color: "#475569", mb: 0.2 }}>
                  <strong>Payment Terms:</strong> {b2bPaymentTerms}
                </Typography>
                <Typography sx={{ fontSize: "9px", color: "#475569", mb: 0.2 }}>
                  <strong>Delivery Period:</strong> {b2bDeliveryDays}
                </Typography>
                <Typography sx={{ fontSize: "9px", color: "#475569" }}>
                  <strong>Price Basis:</strong> Ex-Factory / To-Pay Freight
                </Typography>
              </Box>
            </Box>

            {/* Commercial Schedule Table */}
            <Box sx={{ mb: 0.35 }}>
              <Typography sx={{ fontWeight: 900, color: "#b45309", textTransform: "uppercase", fontSize: "10px", letterSpacing: 0.8, mb: 0.35, borderBottom: "2px solid #d97706", pb: 0.2, display: "inline-block" }}>
                Schedule of Materials & Rates
              </Typography>
            </Box>
            <Box className="print-table-wrapper" sx={{ overflow: "hidden", borderRadius: 1.5, border: "1px solid #e2e8f0", mb: 1 }}>
              <table style={{ width: "100%", fontSize: "9.5px", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#fef3c7", color: "#92400e", borderBottom: "2px solid #fde68a" }}>
                    <th style={{ padding: "5px 4px", textAlign: "center", width: "32px" }}>S.No.</th>
                    <th style={{ padding: "5px 4px", textAlign: "left" }}>Description of Goods</th>
                    <th style={{ padding: "5px 4px", textAlign: "center", width: "95px" }}>SKU Code</th>
                    <th style={{ padding: "5px 4px", textAlign: "center", width: "45px" }}>Unit</th>
                    <th style={{ padding: "5px 4px", textAlign: "center", width: "45px" }}>Qty</th>
                    <th style={{ padding: "5px 4px", textAlign: "right", width: "85px" }}>Rate (INR)</th>
                    <th style={{ padding: "5px 4px", textAlign: "center", width: "48px" }}>GST</th>
                    <th style={{ padding: "5px 4px", textAlign: "right", width: "90px" }}>Amount (INR)</th>
                  </tr>
                </thead>
                <tbody>
                  {b2bItems.map((item, i) => (
                    <tr key={i} style={{ backgroundColor: i % 2 === 1 ? "#fffdf5" : "white", borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "4px 4px", textAlign: "center", fontWeight: 700 }}>{i + 1}</td>
                      <td style={{ padding: "4px 4px", fontWeight: 600 }}>
                        {item.name}
                        <br />
                        <span style={{ fontSize: "8px", color: "#64748b" }}>Category: {item.category}</span>
                      </td>
                      <td style={{ padding: "4px 4px", textAlign: "center", fontFamily: "monospace", color: "#64748b", fontSize: "8.5px" }}>
                        {item.sku}
                      </td>
                      <td style={{ padding: "4px 4px", textAlign: "center" }}>{item.unit}</td>
                      <td style={{ padding: "4px 4px", textAlign: "center", fontWeight: 800 }}>{item.qty}</td>
                      <td style={{ padding: "4px 4px", textAlign: "right", fontWeight: 600 }}>
                        ₹{formatCurrency(item.basePrice)}
                      </td>
                      <td style={{ padding: "4px 4px", textAlign: "center", color: (item.gstRate === 5 ? "#059669" : "#475569"), fontWeight: 700 }}>
                        {item.gstRate !== undefined ? item.gstRate : 18}%
                      </td>
                      <td style={{ padding: "4px 4px", textAlign: "right", fontWeight: 800, color: "#92400e" }}>
                        ₹{formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>

            {/* Financial Summary */}
            <Box className="avoid-break" sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
              <Box sx={{ width: "52%", border: "1px solid #e2e8f0", borderRadius: 1.5, overflow: "hidden" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", p: "3.5px 8px", borderBottom: "1px solid #e2e8f0", bgcolor: "#f8fafc" }}>
                  <Typography sx={{ fontSize: "9.5px", fontWeight: 600 }}>Taxable Value (Subtotal):</Typography>
                  <Typography sx={{ fontSize: "9.5px", fontWeight: 700 }}>₹ {formatCurrency(b2bSubtotal)}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", p: "3.5px 8px", borderBottom: "1px solid #e2e8f0" }}>
                  <Typography sx={{ fontSize: "9.5px", fontWeight: 600 }}>{b2bGstLabel}</Typography>
                  <Typography sx={{ fontSize: "9.5px", fontWeight: 700 }}>₹ {formatCurrency(b2bGstAmount)}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", p: "5px 8px", bgcolor: "#d97706" }}>
                  <Typography sx={{ fontSize: "11.5px", fontWeight: 900, color: "white" }}>Grand Total (INR):</Typography>
                  <Typography sx={{ fontSize: "11.5px", fontWeight: 900, color: "white" }}>₹ {formatCurrency(b2bGrandTotal)}</Typography>
                </Box>
                <Box sx={{ p: "3.5px 8px", bgcolor: "#fffbeb", borderTop: "1px solid #fde68a" }}>
                  <Typography sx={{ fontSize: "8px", color: "#92400e", fontWeight: 600, fontStyle: "italic" }}>
                    Amount in Words: {numberToWordsINR(b2bGrandTotal)}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Commercial Terms */}
            <Box className="avoid-break" sx={{ fontSize: "8.5px", borderTop: "1px solid #e2e8f0", pt: 0.75, mb: 1 }}>
              <Typography sx={{ fontWeight: 900, color: "#b45309", textTransform: "uppercase", mb: 0.35, letterSpacing: 0.8, fontSize: "8.5px" }}>
                Terms & Conditions
              </Typography>
              <Box component="ol" sx={{ pl: 2, color: "#475569", m: 0, "& li": { mb: 0.2, lineHeight: 1.3 } }}>
                {b2bTerms.map((term, i) => (
                  <li key={i} dangerouslySetInnerHTML={{ __html: term.replace(/^([^:]+):/, '<strong>$1:</strong>') }} />
                ))}
              </Box>
            </Box>

            {/* Bank Details Box */}
            <Box className="avoid-break" sx={{ mb: 1, bgcolor: "#f8fafc", p: 0.8, borderRadius: 1.5, border: "1px solid #e2e8f0" }}>
              <Typography sx={{ fontWeight: 800, color: "#b45309", mb: 0.2, textTransform: "uppercase", fontSize: "8px", letterSpacing: 0.8 }}>
                Bank Transfer / NEFT / RTGS Details
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.4, fontSize: "8.5px", color: "#475569" }}>
                <Typography sx={{ fontSize: "8.5px" }}><strong>Account Name:</strong> {activeCompany.bank?.accountName || ""}</Typography>
                <Typography sx={{ fontSize: "8.5px" }}><strong>Bank:</strong> {activeCompany.bank?.name || ""}</Typography>
                <Typography sx={{ fontSize: "8.5px" }}><strong>Account No:</strong> {activeCompany.bank?.accountNumber || ""}</Typography>
                <Typography sx={{ fontSize: "8.5px" }}><strong>IFSC:</strong> {activeCompany.bank?.ifsc || ""}</Typography>
                <Typography sx={{ fontSize: "8.5px" }}><strong>Branch:</strong> {activeCompany.bank?.branch || ""}</Typography>
                {activeCompany.bank?.upiId && (
                  <Typography sx={{ fontSize: "8.5px" }}><strong>UPI:</strong> {activeCompany.bank.upiId}</Typography>
                )}
              </Box>
            </Box>

            {/* B2B Signatures */}
            <Box className="avoid-break" sx={{ mt: 1.2, display: "flex", justifyContent: "space-between", alignItems: "flex-end", px: 1 }}>
              <Box sx={{ textAlign: "center" }}>
                <Typography sx={{ fontSize: "8.5px", fontWeight: 700, color: "#1e3a5f", mb: 0.2 }}>Buyer Acceptance (Seal & Sign)</Typography>
                <Box sx={{ width: 130, height: 28 }} />
                <Box sx={{ width: 130, height: 1, bgcolor: "#cbd5e1", mb: 0.2, mx: "auto" }} />
                <Typography sx={{ fontSize: "7.5px", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Authorized Signatory</Typography>
                <Typography sx={{ fontSize: "8px", color: "#475569", fontWeight: 600 }}>{customerName || "Customer Firm"}</Typography>
              </Box>
              <Box sx={{ textAlign: "right" }}>
                <Typography sx={{ fontSize: "10.5px", fontWeight: 900, color: "#b45309", mb: 0, textDecoration: "underline", textDecorationColor: "#d97706", textUnderlineOffset: 3 }}>
                  For {activeCompany.name}
                </Typography>
                <Box sx={{ minHeight: 52, display: "flex", alignItems: "center", justifyContent: "flex-end", my: 0.2 }}>
                  {((activeCompany as any).signature || (activeCompany as any).stamp) ? (
                    <Box 
                      component="img" 
                      src={resolveMediaUrl((activeCompany as any).signature || (activeCompany as any).stamp)} 
                      alt="Official Stamp & Signature" 
                      sx={{ maxHeight: 56, maxWidth: 170, objectFit: "contain", display: "block", ml: "auto", mixBlendMode: "multiply" }} 
                      onError={(e: any) => { e.target.style.display = 'none'; }} 
                    />
                  ) : (
                    <Box sx={{ height: 48 }} />
                  )}
                </Box>
                <Box sx={{ width: 140, height: 1, bgcolor: "#cbd5e1", mb: 0.2, ml: "auto" }} />
                <Typography sx={{ fontSize: "7.5px", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Authorized Signatory</Typography>
              </Box>
            </Box>
          </>) : isServiceMode ? (<>
            {/* Service Header */}
            <Box className="avoid-break" sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "4px solid #0d47a1", pb: 1.5, mb: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                {activeCompany.logo ? (
                  <Box component="img" src={resolveMediaUrl(activeCompany.logo)} alt="Logo" sx={{ maxHeight: 100, maxWidth: 260, objectFit: "contain" }} onError={(e: any) => { e.target.style.display = 'none'; }} />
                ) : null}
                <Box>
                  <Typography sx={{ fontSize: activeCompany.name.length > 25 ? "15px" : "22px", fontWeight: 900, color: "#0d47a1", letterSpacing: "-0.5px", lineHeight: 1.1, textTransform: "uppercase" }}>{activeCompany.name}</Typography>
                  <Typography sx={{ fontSize: "9.5px", fontWeight: 600, color: "#64748b", mt: 0.25, letterSpacing: 0.8, textTransform: "uppercase" }}>{activeCompany.tagline}</Typography>
                  <Box sx={{ fontSize: "8.5px", color: "#64748b", mt: 0.5 }}>
                    <Typography sx={{ color: "#0d47a1", fontWeight: 700, mb: 0.2, fontSize: "8.5px" }}>GSTIN: {activeCompany.gstin}{(activeCompany as any).cin ? ` | CIN: ${(activeCompany as any).cin}` : ''}</Typography>
                    <Typography sx={{ fontSize: "8.5px" }}><strong>Office:</strong> {activeCompany.headOffice}</Typography>
                    {(activeCompany as any).warehouse && <Typography sx={{ fontSize: "8.5px" }}><strong>Warehouse:</strong> {(activeCompany as any).warehouse}</Typography>}
                    <Typography sx={{ fontSize: "8.5px" }}>📞 +91 {activeCompany.phone}</Typography>
                  </Box>
                </Box>
              </Box>
              <Box sx={{ textAlign: "right" }}>
                <Box sx={{ bgcolor: "#0d47a1", color: "white", px: 1.5, py: 0.5, fontSize: "10px", fontWeight: 900, borderRadius: 1, mb: 0.75, textTransform: "uppercase", letterSpacing: 1 }}>Service Proposal</Box>
                <Typography sx={{ fontSize: "10px", color: "#64748b", fontWeight: 700 }} suppressHydrationWarning>Date: {currentDate}</Typography>
                <Typography sx={{ fontSize: "9.5px", color: "#94a3b8" }}>Reference: {serviceRefNumber}</Typography>
              </Box>
            </Box>

            {/* Proposal Title */}
            <Box className="avoid-break" sx={{ textAlign: "center", mb: 1.5, py: 1, bgcolor: "#e3f2fd", borderRadius: 1.5, border: "1px solid #90caf9" }}>
              <Typography sx={{ fontSize: "14px", fontWeight: 900, color: "#0d47a1", textTransform: "uppercase", letterSpacing: 1.5 }}>{serviceProposalTitle}</Typography>
            </Box>

            {/* Prepared For */}
            <Box className="avoid-break" sx={{ mb: 1.5, bgcolor: "#f8fafc", p: 1.2, borderRadius: 1.5, border: "1px solid #e2e8f0" }}>
              <Typography sx={{ fontWeight: 700, color: "#0d47a1", mb: 0.5, textTransform: "uppercase", fontSize: "9px", letterSpacing: 0.8, borderBottom: "1px solid #e2e8f0", pb: 0.25 }}>Prepared For</Typography>
              <Typography sx={{ fontWeight: 900, color: "#1e40af", fontSize: "14px" }}>{customerName || "________________"}</Typography>
              {customerAddress && <Typography sx={{ color: "#475569", fontWeight: 500, fontSize: "10px", fontStyle: "italic", mt: 0.25 }}>{customerAddress}</Typography>}
              {customerPhone && <Typography sx={{ color: "#475569", fontWeight: 500, fontSize: "10px" }}>📞 {customerPhone}</Typography>}
            </Box>

            {/* Commercial Details Table */}
            <Box sx={{ mb: 0.5 }}>
              <Typography sx={{ fontWeight: 900, color: "#0d47a1", textTransform: "uppercase", fontSize: "10.5px", letterSpacing: 1, mb: 0.5, borderBottom: "2px solid #0d47a1", pb: 0.25, display: "inline-block" }}>Commercial Details</Typography>
            </Box>
            <Box className="print-table-wrapper" sx={{ overflow: "hidden", borderRadius: 1.5, border: "1px solid #e2e8f0", mb: 1.5 }}>
              <table style={{ width: "100%", fontSize: "10.5px", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#e3f2fd", color: "#0d47a1", borderBottom: "2px solid #90caf9" }}>
                    <th style={{ padding: "6px 6px", textAlign: "center", width: "35px" }}>S.No.</th>
                    <th style={{ padding: "6px 6px", textAlign: "left" }}>Description</th>
                    <th style={{ padding: "6px 6px", textAlign: "center", width: "75px" }}>HSN/SAC</th>
                    <th style={{ padding: "6px 6px", textAlign: "center", width: "35px" }}>Qty</th>
                    <th style={{ padding: "6px 6px", textAlign: "center", width: "55px" }}>Unit</th>
                    <th style={{ padding: "6px 6px", textAlign: "right", width: "100px" }}>Rate (INR)</th>
                    <th style={{ padding: "6px 6px", textAlign: "right", width: "100px" }}>Amount (INR)</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceItems.map((item, i) => (
                    <tr key={i} style={{ backgroundColor: i % 2 === 1 ? "#f8fafc" : "white", borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "6px 6px", textAlign: "center", fontWeight: 700 }}>{item.sno}</td>
                      <td style={{ padding: "6px 6px", fontWeight: 600 }}>
                        {item.description}
                        {item.unit === "Month" ? (
                          <><br /><span style={{ fontSize: "8.5px", color: "#64748b" }}>(Rate: ₹{formatCurrency(item.rate)}/Month)</span></>
                        ) : item.monthlyRate ? (
                          <><br /><span style={{ fontSize: "8.5px", color: "#64748b" }}>(Monthly Rate: ₹{formatCurrency(item.monthlyRate)})</span></>
                        ) : null}
                      </td>
                      <td style={{ padding: "6px 6px", textAlign: "center", color: "#64748b" }}>{item.hsnSac}</td>
                      <td style={{ padding: "6px 6px", textAlign: "center", fontWeight: 700 }}>{item.qty}</td>
                      <td style={{ padding: "6px 6px", textAlign: "center" }}>{item.unit === "Month" ? "Per Month" : item.unit}</td>
                      <td style={{ padding: "6px 6px", textAlign: "right", fontWeight: 600 }}>{item.unit === "Month" ? formatCurrency(item.rate) : formatCurrency(item.rate)}</td>
                      <td style={{ padding: "6px 6px", textAlign: "right", fontWeight: 700 }}>{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>

            {/* Totals */}
            <Box className="avoid-break" sx={{ display: "flex", justifyContent: "flex-end", mb: 1.5 }}>
              <Box sx={{ width: "50%", border: "1px solid #e2e8f0", borderRadius: 1.5, overflow: "hidden" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", p: "6px 10px", borderBottom: "1px solid #e2e8f0", bgcolor: "#f8fafc" }}>
                  <Typography sx={{ fontSize: "10.5px", fontWeight: 600 }}>Sub Total:</Typography>
                  <Typography sx={{ fontSize: "10.5px", fontWeight: 700 }}>₹ {formatCurrency(serviceSubtotal)}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", p: "6px 10px", borderBottom: "1px solid #e2e8f0" }}>
                  <Typography sx={{ fontSize: "10.5px", fontWeight: 600 }}>{serviceGst}% GST:</Typography>
                  <Typography sx={{ fontSize: "10.5px", fontWeight: 700 }}>₹ {formatCurrency(serviceGstAmount)}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", p: "8px 10px", bgcolor: "#0d47a1" }}>
                  <Typography sx={{ fontSize: "12px", fontWeight: 900, color: "white" }}>Grand Total:</Typography>
                  <Typography sx={{ fontSize: "12px", fontWeight: 900, color: "white" }}>₹ {formatCurrency(serviceGrandTotal)}</Typography>
                </Box>
              </Box>
            </Box>

            {/* Service Terms */}
            <Box className="avoid-break" sx={{ fontSize: "9.5px", borderTop: "1px solid #e2e8f0", pt: 1, mb: 1.5 }}>
              <Typography sx={{ fontWeight: 900, color: "#0d47a1", textTransform: "uppercase", mb: 0.5, letterSpacing: 0.8, fontSize: "10px" }}>Terms & Conditions</Typography>
              <Box component="ol" sx={{ pl: 2, color: "#475569", m: 0, "& li": { mb: 0.35, lineHeight: 1.4 } }}>
                {serviceTerms.map((term, i) => (
                  <li key={i} dangerouslySetInnerHTML={{ __html: term.replace(/^([^:]+):/, '<strong>$1:</strong>') }} />
                ))}
              </Box>
            </Box>

            {/* Service Signatures */}
            <Box className="avoid-break" sx={{ mt: 2, display: "flex", justifyContent: "space-between", alignItems: "flex-end", px: 1 }}>
              <Box sx={{ textAlign: "center" }}>
                <Typography sx={{ fontSize: "9px", fontWeight: 700, color: "#1e3a5f", mb: 0.25 }}>Client Acceptance</Typography>
                <Box sx={{ width: 140, height: 40 }} />
                <Box sx={{ width: 140, height: 1, bgcolor: "#cbd5e1", mb: 0.25, mx: "auto" }} />
                <Typography sx={{ fontSize: "8px", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Authorized Signatory</Typography>
                <Typography sx={{ fontSize: "8px", color: "#475569", fontWeight: 600 }}>{customerName || "Client"}</Typography>
              </Box>
              <Box sx={{ textAlign: "right" }}>
                <Typography sx={{ fontSize: "12px", fontWeight: 900, color: "#0d47a1", mb: 0, textDecoration: "underline", textDecorationColor: "#0d47a1", textUnderlineOffset: 3 }}>For {activeCompany.name}</Typography>
                <Box sx={{ minHeight: 60, display: "flex", alignItems: "center", justifyContent: "flex-end", my: 0.2 }}>
                  {((activeCompany as any).signature || (activeCompany as any).stamp) ? (
                    <Box 
                      component="img" 
                      src={resolveMediaUrl((activeCompany as any).signature || (activeCompany as any).stamp)} 
                      alt="Official Stamp & Signature" 
                      sx={{ maxHeight: 65, maxWidth: 180, objectFit: "contain", display: "block", ml: "auto", mixBlendMode: "multiply" }} 
                      onError={(e: any) => { e.target.style.display = 'none'; }} 
                    />
                  ) : (
                    <Box sx={{ height: 48 }} />
                  )}
                </Box>
                <Box sx={{ width: 160, height: 1, bgcolor: "#cbd5e1", mb: 0.25, ml: "auto" }} />
                <Typography sx={{ fontSize: "8px", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Authorized Signatory</Typography>
              </Box>
            </Box>
          </>) : (<>

            {/* ===== SOLAR PREVIEW (ON-GRID, OFF-GRID, HYBRID, VFD) ===== */}
            {/* Header */}
            <Box className="avoid-break" sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3.5px solid #eab308", pb: 1, mb: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.75 }}>
                {activeCompany.logo ? (
                  <Box component="img" src={resolveMediaUrl(activeCompany.logo)} alt="Logo" sx={{ maxHeight: 100, maxWidth: 260, objectFit: "contain" }} onError={(e: any) => { e.target.style.display = 'none'; }} />
                ) : null}
                <Box>
                  <Typography sx={{ fontSize: activeCompany.name.length > 25 ? "15px" : "20px", fontWeight: 900, color: "#1e3a5f", letterSpacing: "-0.5px", lineHeight: 1.1, textTransform: "uppercase" }}>{activeCompany.name}</Typography>
                  <Typography sx={{ fontSize: "9.5px", fontWeight: 600, color: "#64748b", mt: 0.2, letterSpacing: 0.8, textTransform: "uppercase" }}>{activeCompany.tagline}</Typography>
                  <Box sx={{ fontSize: "8.5px", color: "#64748b", mt: 0.35 }}>
                    <Typography sx={{ color: "#1d4ed8", fontWeight: 700, mb: 0.15, fontSize: "8.5px" }}>GSTIN: {activeCompany.gstin}{(activeCompany as any).cin ? ` | CIN: ${(activeCompany as any).cin}` : ''}</Typography>
                    <Typography sx={{ fontSize: "8.5px" }}><strong>HO:</strong> {activeCompany.headOffice}</Typography>
                    {(activeCompany as any).warehouse && <Typography sx={{ fontSize: "8.5px" }}><strong>WH:</strong> {(activeCompany as any).warehouse}</Typography>}
                    <Typography sx={{ fontSize: "8.5px" }}><strong>Contact:</strong> +91 {activeCompany.phone}{activeCompany.email ? ` | ${activeCompany.email}` : ''}</Typography>
                  </Box>
                </Box>
              </Box>
              <Box sx={{ textAlign: "right" }}>
                <Box sx={{ bgcolor: "#eab308", color: "white", px: 1.5, py: 0.4, fontSize: "11px", fontWeight: 900, borderRadius: 1, mb: 0.5, textTransform: "uppercase", letterSpacing: 1.2 }}>Quotation</Box>
                <Typography sx={{ fontSize: "10px", color: "#64748b", fontWeight: 700 }} suppressHydrationWarning>Date: {currentDate}</Typography>
                {quoteNumber && <Typography sx={{ fontSize: "9px", color: "#94a3b8" }}>Quote No: {quoteNumber}</Typography>}
                <Typography sx={{ fontSize: "8.5px", color: "#eab308", fontWeight: 700, textTransform: "uppercase" }}>{selectedSystemType} System</Typography>
              </Box>
            </Box>

            {/* Customer & System Overview */}
            <Box className="avoid-break" sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.25, mb: 1 }}>
              <Box sx={{ bgcolor: "#f8fafc", p: 1, borderRadius: 1.5, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                <Typography sx={{ fontWeight: 800, color: "#1e3a5f", mb: 0.35, textTransform: "uppercase", fontSize: "8.5px", letterSpacing: 0.8, borderBottom: "1px solid #e2e8f0", pb: 0.2 }}>Customer Details</Typography>
                <Typography sx={{ fontWeight: 900, color: "#1e40af", fontSize: "12.5px", wordBreak: "break-word" }}>{customerName || "________________"}</Typography>
                {customerAddress && <Typography sx={{ color: "#475569", fontWeight: 500, fontSize: "9px", fontStyle: "italic", wordBreak: "break-word", mt: 0.2 }}>{customerAddress}</Typography>}
                {customerPhone && <Typography sx={{ color: "#475569", fontWeight: 600, fontSize: "9px", mt: 0.15 }}>Mo No: +91 {customerPhone}</Typography>}
              </Box>
              <Box sx={{ bgcolor: "#f8fafc", p: 1, borderRadius: 1.5, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                <Typography sx={{ fontWeight: 800, color: "#1e3a5f", mb: 0.35, textTransform: "uppercase", fontSize: "8.5px", letterSpacing: 0.8, borderBottom: "1px solid #e2e8f0", pb: 0.2 }}>System Specifications</Typography>
                <Box sx={{ fontSize: "9px" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.15 }}><span>System Size:</span> <strong>{actualSystemSize} KW ({phase === 1 ? "Single Phase" : "Three Phase"})</strong></Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.15, wordBreak: "break-word" }}><span>Modules:</span> <strong style={{ textAlign: "right", maxWidth: "65%" }}>{effectivePanelBrand} {panelWattage}Wp ({panelType})</strong></Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.15, color: "#475569" }}><span>Module Warranty:</span> <strong>{panelWarranty}</strong></Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.15, wordBreak: "break-word" }}><span>Inverter:</span> <strong style={{ textAlign: "right", maxWidth: "65%" }}>{effectiveInverterBrand} {inverterModel}</strong></Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.15, color: "#475569" }}><span>Inverter Warranty:</span> <strong>{inverterWarranty}</strong></Box>
                  {(selectedSystemType === "Hybrid" || selectedSystemType === "Off-grid") && (
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.15, color: "#475569" }}><span>Battery Warranty:</span> <strong>{effectiveBatteryWarranty}</strong></Box>
                  )}
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}><span>System Type:</span> <strong>{selectedSystemType}</strong></Box>
                </Box>
              </Box>
            </Box>

            {/* Components Table */}
            <Box sx={{ mb: 0.35 }}>
              <Typography sx={{ fontWeight: 900, color: "#1e3a5f", textTransform: "uppercase", fontSize: "10px", letterSpacing: 0.8, mb: 0.35, borderBottom: "2px solid #eab308", pb: 0.2, display: "inline-block" }}>
                Technical Bill of Materials (BOM)
              </Typography>
            </Box>
            <Box className="print-table-wrapper" sx={{ overflow: "hidden", borderRadius: 1.5, border: "1px solid #e2e8f0", mb: 1 }}>
              <table style={{ width: "100%", fontSize: "9px", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f1f5f9", color: "#1e3a5f", borderBottom: "1.5px solid #cbd5e1" }}>
                    <th style={{ padding: "4px 4px", textAlign: "center", width: "26px" }}>S.N</th>
                    <th style={{ padding: "4px 4px", textAlign: "left", width: "25%" }}>Components</th>
                    <th style={{ padding: "4px 4px", textAlign: "left" }}>Description</th>
                    <th style={{ padding: "4px 4px", textAlign: "center", width: "50px" }}>Qty</th>
                    <th style={{ padding: "4px 4px", textAlign: "center", width: "75px" }}>Make</th>
                  </tr>
                </thead>
                <tbody>
                  {components.map((comp, index) => (
                    <tr key={index} style={{ backgroundColor: index % 2 === 1 ? "#f8fafc80" : "white", borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "3.5px 4px", textAlign: "center", fontWeight: 700 }}>{index + 1}</td>
                      <td style={{ padding: "3.5px 4px", fontWeight: 700, color: "#1e293b" }}>{comp.name}</td>
                      <td style={{ padding: "3.5px 4px", color: index < 2 ? "#1e293b" : "#475569" }}>{comp.description}</td>
                      <td style={{ padding: "3.5px 4px", textAlign: "center", fontWeight: 700 }}>{comp.quantity}</td>
                      <td style={{ padding: "3.5px 4px", textAlign: "center", fontWeight: 700, color: "#1e40af" }}>{comp.make}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>

            {/* Financials, Savings & Bank Details Grid */}
            <Box className="avoid-break" sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.25, mb: 1 }}>
              {/* Left Column: Generation, Savings & Bank Details */}
              <Box sx={{ bgcolor: "#f8fafc", p: 1, borderRadius: 1.5, border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                {/* Generation & Savings metrics */}
                <Box sx={{ mb: 0.5 }}>
                  <Typography sx={{ fontWeight: 800, color: "#1e3a5f", fontSize: "9px", textTransform: "uppercase", mb: 0.35, letterSpacing: 0.8, borderBottom: "1px solid #e2e8f0", pb: 0.2 }}>
                    Energy Generation & Financial Returns
                  </Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0.5, textAlign: "center" }}>
                    <Box sx={{ p: 0.4, bgcolor: "white", borderRadius: 1, border: "1px solid #e2e8f0" }}>
                      <Typography sx={{ fontSize: "7.5px", color: "#64748b", textTransform: "uppercase" }}>Generation</Typography>
                      <Typography sx={{ fontSize: "9.5px", fontWeight: 800, color: "#0f172a" }}>{calculations.annualUnits} U/Yr</Typography>
                    </Box>
                    <Box sx={{ p: 0.4, bgcolor: "white", borderRadius: 1, border: "1px solid #e2e8f0" }}>
                      <Typography sx={{ fontSize: "7.5px", color: "#64748b", textTransform: "uppercase" }}>Annual Savings</Typography>
                      <Typography sx={{ fontSize: "9.5px", fontWeight: 800, color: "#16a34a" }}>₹ {formatCurrency(calculations.annualSavings)}</Typography>
                    </Box>
                    <Box sx={{ p: 0.4, bgcolor: "white", borderRadius: 1, border: "1px solid #e2e8f0" }}>
                      <Typography sx={{ fontSize: "7.5px", color: "#64748b", textTransform: "uppercase" }}>Payback (ROI)</Typography>
                      <Typography sx={{ fontSize: "9.5px", fontWeight: 800, color: "#ea580c" }}>{calculations.roiYears} Yrs</Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Bank Account & Payment details */}
                <Box sx={{ bgcolor: "#eff6ff", p: 0.6, borderRadius: 1, border: "1px solid #bfdbfe", display: "flex", alignItems: "center", gap: 1 }}>
                  <Box sx={{ flex: 1, fontSize: "8.5px", color: "#334155" }}>
                    <Typography sx={{ fontWeight: 800, color: "#1e3a5f", textTransform: "uppercase", fontSize: "8px", mb: 0.15 }}>Bank & Payment Details</Typography>
                    <Typography sx={{ fontSize: "8px" }}><strong>A/c Name:</strong> {activeCompany.bank?.accountName || ""}</Typography>
                    <Typography sx={{ fontSize: "8px" }}><strong>Bank:</strong> {activeCompany.bank?.name || ""}{activeCompany.bank?.branch ? `, ${activeCompany.bank?.branch}` : ''}</Typography>
                    <Typography sx={{ fontSize: "8px" }}><strong>A/c No:</strong> {activeCompany.bank?.accountNumber || ""} | <strong>IFSC:</strong> {activeCompany.bank?.ifsc || ""}</Typography>
                    {activeCompany.bank?.upiId && (
                      <Typography sx={{ fontSize: "8px", color: "#1d4ed8" }}><strong>UPI:</strong> {activeCompany.bank.upiId}</Typography>
                    )}
                  </Box>
                  {(activeCompany.bank?.upiId || (activeCompany as any).qr_code_url) && (
                    <Box sx={{ textAlign: "center", flexShrink: 0 }}>
                      <a href={`upi://pay?pa=${activeCompany.bank?.upiId || ''}&pn=${encodeURIComponent(activeCompany.name)}&am=${calculations.totalAmount}&cu=INR`} style={{ textDecoration: "none" }}>
                        <Box 
                          component="img" 
                          src={(activeCompany as any).qr_code_url || (activeCompany.bank?.upiId ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`upi://pay?pa=${activeCompany.bank.upiId}&pn=${encodeURIComponent(activeCompany.name)}&am=${calculations.totalAmount}&cu=INR`)}` : '')} 
                          alt="Payment QR" 
                          sx={{ width: 44, height: 44, objectFit: "contain", mixBlendMode: "multiply", display: "block" }} 
                          onError={(e: any) => { e.target.style.display = 'none'; }} 
                        />
                      </a>
                      <Typography sx={{ fontSize: "7px", color: "#64748b", mt: 0.1 }}>Scan UPI</Typography>
                    </Box>
                  )}
                </Box>
              </Box>

              {/* Right Column: Investment Summary & Subsidy Benefit */}
              <Box sx={{ bgcolor: "#f8fafc", p: 1, borderRadius: 1.5, border: "1px solid #bfdbfe", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <Box>
                  <Typography sx={{ fontWeight: 800, color: "#1e3a5f", fontSize: "9px", textTransform: "uppercase", mb: 0.5, letterSpacing: 0.8, borderBottom: "1px solid #bfdbfe", pb: 0.2 }}>
                    Investment & Pricing Summary
                  </Typography>
                  <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "9.5px", py: 0.15, color: "#475569" }}>
                    <span>Base Price:</span><span>₹ {formatCurrency(calculations.originalBasePrice)}</span>
                  </Box>
                  {extraCosts.structureCost > 0 && (
                    <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "9.5px", py: 0.15, color: "#d97706" }}>
                      <span>+ Extra Structure:</span><span>₹ {formatCurrency(extraCosts.structureCost)}</span>
                    </Box>
                  )}
                  {extraCosts.panelsCost > 0 && (
                    <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "9.5px", py: 0.15, color: "#d97706" }}>
                      <span>+ Extra Panels ({extraPanelCount}):</span><span>₹ {formatCurrency(extraCosts.panelsCost)}</span>
                    </Box>
                  )}
                  {extraCosts.wireCost > 0 && (
                    <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "9.5px", py: 0.15, color: "#d97706" }}>
                      <span>+ Extra Wire ({extraWireLength}m):</span><span>₹ {formatCurrency(extraCosts.wireCost)}</span>
                    </Box>
                  )}
                  <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "9.5px", py: 0.15, color: "#475569", borderBottom: "1px solid #e2e8f0", pb: 0.35, mb: 0.25 }}>
                    <span>GST (@ {gstRate}%):</span><span>₹ {formatCurrency(calculations.gstAmount)}</span>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 900, color: "#1e3a5f", pt: 0.25 }}>
                    <span style={{ fontSize: "9.5px", textTransform: "uppercase" }}>Total Amount:</span>
                    <span style={{ color: "#1e40af" }}>₹ {formatCurrency(calculations.totalAmount)}</span>
                  </Box>
                </Box>

                {calculations.totalSubsidy > 0 ? (
                  <Box sx={{ mt: 0.75, p: 0.75, bgcolor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 1 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "8.5px", color: "#166534" }}>
                      <span>Central: <strong>₹ {formatCurrency(centralSubsidy)}</strong></span>
                      <span>State: <strong>₹ {formatCurrency(stateSubsidy)}</strong></span>
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 0.35, borderTop: "1px dashed #bbf7d0", mt: 0.35 }}>
                      <Typography sx={{ fontSize: "8.5px", color: "#166534", textTransform: "uppercase", fontWeight: 900 }}>
                        Effective Cost:
                      </Typography>
                      <Typography sx={{ fontSize: "15px", fontWeight: 900, color: "#16a34a" }}>
                        ₹ {formatCurrency(calculations.effectiveCost)}*
                      </Typography>
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ mt: 0.75, p: 0.6, bgcolor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 1, textAlign: "center" }}>
                    <Typography sx={{ fontSize: "8px", color: "#1e40af", textTransform: "uppercase", fontWeight: 800 }}>Net Investment Payable</Typography>
                    <Typography sx={{ fontSize: "13px", fontWeight: 900, color: "#1e40af" }}>₹ {formatCurrency(calculations.totalAmount)}</Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Terms and Conditions */}
            <Box className="avoid-break" sx={{ fontSize: "8px", borderTop: "1px solid #e2e8f0", pt: 0.75, mb: 1 }}>
              <Typography sx={{ fontWeight: 900, color: "#1e293b", textTransform: "uppercase", mb: 0.35, letterSpacing: 0.8, fontSize: "8.5px" }}>Terms and Conditions</Typography>
              <Box component="ul" sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5px 20px", pl: 2, color: "#64748b", m: 0 }}>
                {terms.map((term, i) => <li key={i} style={{ lineHeight: 1.3 }} dangerouslySetInnerHTML={{ __html: term.replace(/^([^:]+):/, '<strong>$1:</strong>') }} />)}
              </Box>
            </Box>

            {/* Signatures */}
            <Box className="avoid-break" sx={{ mt: 1, display: "flex", justifyContent: "space-between", alignItems: "flex-end", px: 1 }}>
              <Box sx={{ textAlign: "center" }}>
                <Typography sx={{ fontSize: "8.5px", fontWeight: 700, color: "#1e3a5f", mb: 0.2 }}>Customer Acceptance</Typography>
                <Box sx={{ width: 130, height: 28 }} />
                <Box sx={{ width: 130, height: 1, bgcolor: "#cbd5e1", mb: 0.2, mx: "auto" }} />
                <Typography sx={{ fontSize: "7.5px", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Customer Signature</Typography>
                <Typography sx={{ fontSize: "8px", color: "#475569", fontWeight: 600 }}>{customerName || "Customer"}</Typography>
              </Box>
              <Box sx={{ textAlign: "right", position: "relative" }}>
                <Typography sx={{ fontSize: "10.5px", fontWeight: 900, color: "#1e3a5f", mb: 0, textDecoration: "underline", textDecorationColor: "#eab308", textUnderlineOffset: 3 }}>For {activeCompany.name}</Typography>
                <Box sx={{ minHeight: 56, display: "flex", alignItems: "center", justifyContent: "flex-end", my: 0.3 }}>
                  {((activeCompany as any).signature || (activeCompany as any).stamp) ? (
                    <Box 
                      component="img" 
                      src={resolveMediaUrl((activeCompany as any).signature || (activeCompany as any).stamp)} 
                      alt="Official Stamp & Signature" 
                      sx={{ maxHeight: 62, maxWidth: 180, objectFit: "contain", display: "block", ml: "auto", mixBlendMode: "multiply" }} 
                      onError={(e: any) => { e.target.style.display = 'none'; }} 
                    />
                  ) : (
                    <Box sx={{ height: 48 }} />
                  )}
                </Box>
                <Box sx={{ width: 150, height: 1.5, bgcolor: "#0f172a", mb: 0.2, ml: "auto" }} />
                <Typography sx={{ fontSize: "7.5px", color: "#1e3a5f", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>Authorized Stamp & Signature</Typography>
                <Typography sx={{ fontSize: "8.5px", color: "#334155", fontWeight: 700 }}>{activeCompany.authorizedSignatory}</Typography>
              </Box>
            </Box>
          </>)}
        </Box>
      </Box>

      {/* Edit Component Dialog */}
      <Dialog open={editComponentDialog} onClose={() => setEditComponentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Component</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          <TextField fullWidth label="Component Name" value={editingComponent?.name || ""} onChange={(e) => setEditingComponent((prev) => prev && { ...prev, name: e.target.value })} />
          <TextField fullWidth label="Description" value={editingComponent?.description || ""} onChange={(e) => setEditingComponent((prev) => prev && { ...prev, description: e.target.value })} />
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField fullWidth label="Quantity" value={editingComponent?.quantity || ""} onChange={(e) => setEditingComponent((prev) => prev && { ...prev, quantity: e.target.value })} />
            <TextField fullWidth label="Make" value={editingComponent?.make || ""} onChange={(e) => setEditingComponent((prev) => prev && { ...prev, make: e.target.value })} />
          </Box>
        </DialogContent>
        <DialogActions><Button onClick={() => setEditComponentDialog(false)}>Cancel</Button><Button variant="contained" onClick={handleSaveComponentEdit}>Save</Button></DialogActions>
      </Dialog>

      {/* Add Component Dialog */}
      <Dialog open={addComponentDialog} onClose={() => setAddComponentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Component</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          <TextField fullWidth label="Component Name" value={newComponent.name} onChange={(e) => setNewComponent((prev) => ({ ...prev, name: e.target.value }))} />
          <TextField fullWidth label="Description" value={newComponent.description} onChange={(e) => setNewComponent((prev) => ({ ...prev, description: e.target.value }))} />
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField fullWidth label="Quantity" value={newComponent.quantity} onChange={(e) => setNewComponent((prev) => ({ ...prev, quantity: e.target.value }))} />
            <TextField fullWidth label="Make" value={newComponent.make} onChange={(e) => setNewComponent((prev) => ({ ...prev, make: e.target.value }))} />
          </Box>
        </DialogContent>
        <DialogActions><Button onClick={() => setAddComponentDialog(false)}>Cancel</Button><Button variant="contained" onClick={handleAddComponent}>Add</Button></DialogActions>
      </Dialog>

      {/* Add Custom B2B Item Dialog */}
      <Dialog open={addB2BCustomDialog} onClose={() => setAddB2BCustomDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Custom B2B Line Item</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          <TextField
            fullWidth
            label="Product Name"
            value={customB2BItem.name}
            onChange={(e) => setCustomB2BItem({ ...customB2BItem, name: e.target.value })}
            placeholder="e.g. GI Walkway Mesh 300mm"
            required
          />
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              fullWidth
              label="SKU Code"
              value={customB2BItem.sku}
              onChange={(e) => setCustomB2BItem({ ...customB2BItem, sku: e.target.value })}
              placeholder="e.g. APL-WALK-300"
            />
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={customB2BItem.category}
                label="Category"
                onChange={(e) => setCustomB2BItem({ ...customB2BItem, category: e.target.value })}
              >
                {apolloCategories.filter(c => c !== "All").map((c) => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              fullWidth
              label="Base Rate (₹)"
              type="number"
              value={customB2BItem.basePrice}
              onChange={(e) => setCustomB2BItem({ ...customB2BItem, basePrice: parseFloat(e.target.value) || 0 })}
              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
            />
            <TextField
              fullWidth
              label="Quantity"
              type="number"
              value={customB2BItem.qty}
              onChange={(e) => setCustomB2BItem({ ...customB2BItem, qty: parseFloat(e.target.value) || 1 })}
            />
            <TextField
              fullWidth
              label="Unit"
              value={customB2BItem.unit}
              onChange={(e) => setCustomB2BItem({ ...customB2BItem, unit: e.target.value })}
              placeholder="Pcs / Mtr / BDL"
            />
            <FormControl fullWidth>
              <InputLabel>GST %</InputLabel>
              <Select
                value={customB2BItem.gstRate ?? 18}
                label="GST %"
                onChange={(e) => setCustomB2BItem({ ...customB2BItem, gstRate: Number(e.target.value) })}
              >
                <MenuItem value={18}>18% (Standard)</MenuItem>
                <MenuItem value={5}>5% (Solar / RE)</MenuItem>
                <MenuItem value={12}>12%</MenuItem>
                <MenuItem value={0}>0%</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddB2BCustomDialog(false)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleAddCustomB2BItem}>
            Add Item
          </Button>
        </DialogActions>
      </Dialog>

      {/* WhatsApp Direct Share Modal */}
      <Dialog
        open={whatsAppModal.open}
        onClose={() => setWhatsAppModal({ ...whatsAppModal, open: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <Box sx={{ width: 38, height: 38, borderRadius: '50%', bgcolor: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(37,211,102,0.35)' }}>
            <WhatsApp sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1e293b' }}>
              Quotation Ready for WhatsApp
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Direct chat prepared for +{formatWhatsAppPhoneNumber(whatsAppModal.phone)}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ py: 2 }}>
          {whatsAppModal.pdfUrl && (
            <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} icon={<Check fontSize="small" />}>
              Official PDF uploaded to cloud vault! Document link included below.
            </Alert>
          )}

          <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', mb: 0.8 }}>
            Message Preview (Pre-filled in WhatsApp)
          </Typography>
          <Box
            sx={{
              p: 2,
              bgcolor: '#f8fafc',
              borderRadius: 2,
              border: '1px solid #e2e8f0',
              fontFamily: 'monospace',
              fontSize: '0.82rem',
              whiteSpace: 'pre-wrap',
              maxHeight: 220,
              overflowY: 'auto',
              color: '#1e293b',
              lineHeight: 1.5,
            }}
          >
            {whatsAppModal.message}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={copiedWhatsApp ? <Check /> : <ContentCopy />}
            onClick={() => {
              navigator.clipboard.writeText(whatsAppModal.message);
              setCopiedWhatsApp(true);
              setTimeout(() => setCopiedWhatsApp(false), 2500);
            }}
            sx={{ textTransform: 'none', fontWeight: 600, color: '#475569', borderColor: '#cbd5e1' }}
          >
            {copiedWhatsApp ? "Copied to Clipboard!" : "Copy Message"}
          </Button>

          {whatsAppModal.pdfUrl && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<Launch />}
              onClick={() => window.open(whatsAppModal.pdfUrl!, '_blank')}
              sx={{ textTransform: 'none', fontWeight: 600, color: '#1e3a5f', borderColor: '#cbd5e1' }}
            >
              View PDF
            </Button>
          )}

          <Button
            variant="contained"
            size="small"
            startIcon={<WhatsApp />}
            onClick={() => openWhatsAppDirect(whatsAppModal.phone, whatsAppModal.message)}
            sx={{
              bgcolor: '#25D366',
              '&:hover': { bgcolor: '#128C7E' },
              fontWeight: 700,
              textTransform: 'none',
              ml: 'auto',
              px: 2,
            }}
          >
            Open WhatsApp
          </Button>

          <Button
            size="small"
            onClick={() => setWhatsAppModal({ ...whatsAppModal, open: false })}
            sx={{ color: '#64748b' }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={notification.open} autoHideDuration={5000} onClose={() => setNotification((prev) => ({ ...prev, open: false }))}><Alert severity={notification.severity}>{notification.message}</Alert></Snackbar>
    </Box>
  );
}
