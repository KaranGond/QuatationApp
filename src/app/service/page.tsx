"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, CircularProgress, Typography } from "@mui/material";

export default function ServiceRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/?tab=Service");
  }, [router]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#f8fafc",
        gap: 2,
      }}
    >
      <CircularProgress size={32} sx={{ color: "#0d47a1" }} />
      <Typography variant="body2" sx={{ color: "#64748b", fontWeight: 600 }}>
        Loading Service & O&M Proposal Builder...
      </Typography>
    </Box>
  );
}
