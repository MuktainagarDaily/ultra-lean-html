import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Home from "./pages/Home";
import Shops from "./pages/Shops";
import ShopDetail from "./pages/ShopDetail";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // 30s — don't re-fetch if data is fresh
      gcTime: 300_000,         // 5min — keep in cache after unmount
      retry: 1,                // only one retry on failure (helps on slow networks)
      refetchOnWindowFocus: false, // prevent jarring re-fetches when switching tabs
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
      Loading...
    </div>
  );
  if (!user) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

function CategoryRedirect() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useEffect(() => {
    if (!id) { navigate('/shops', { replace: true }); return; }
    supabase.from('categories').select('name').eq('id', id).single().then(({ data }) => {
      if (data?.name) navigate(`/shops?category=${encodeURIComponent(data.name)}`, { replace: true });
      else navigate('/shops', { replace: true });
    });
  }, [id, navigate]);
  return (
    <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">
      Loading…
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/shops" element={<Shops />} />
            <Route path="/category/:id" element={<CategoryRedirect />} />
            <Route path="/shop/:id" element={<ShopDetail />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
