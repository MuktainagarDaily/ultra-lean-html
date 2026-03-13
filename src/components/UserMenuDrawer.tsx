import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Bookmark, MapPin, Bell, Settings, HelpCircle, LogOut, LogIn, UserPlus, ChevronRight, Sparkles, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
} from '@/components/ui/drawer';

/* ─── Access tier badge ──────────────────────────────────────────────── */
function TierBadge({ tier }: { tier: 'guest' | 'member' | 'admin' }) {
  const map = {
    guest:  { label: 'Guest',  bg: 'hsl(38 95% 52% / 0.15)',  color: 'hsl(30 80% 38%)',  border: 'hsl(38 95% 52% / 0.35)' },
    member: { label: 'Member', bg: 'hsl(214 85% 40% / 0.12)', color: 'hsl(214 85% 36%)', border: 'hsl(214 85% 40% / 0.30)' },
    admin:  { label: 'Admin',  bg: 'hsl(142 72% 38% / 0.12)', color: 'hsl(142 72% 30%)', border: 'hsl(142 72% 38% / 0.30)' },
  };
  const { label, bg, color, border } = map[tier];
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full border tracking-wider uppercase"
      style={{ background: bg, color, borderColor: border }}
    >
      {label}
    </span>
  );
}

/* ─── Single menu row ────────────────────────────────────────────────── */
interface MenuRowProps {
  icon: React.ReactNode;
  label: string;
  desc?: string;
  soon?: boolean;
  danger?: boolean;
  onClick?: () => void;
}
function MenuRow({ icon, label, desc, soon, danger, onClick }: MenuRowProps) {
  return (
    <button
      onClick={onClick}
      disabled={soon}
      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors rounded-xl group
        ${danger
          ? 'hover:bg-destructive/8 active:bg-destructive/12'
          : 'hover:bg-muted active:bg-muted/80'}
        ${soon ? 'opacity-60 cursor-default' : 'cursor-pointer'}
      `}
    >
      <span
        className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-colors
          ${danger
            ? 'bg-destructive/10 text-destructive group-hover:bg-destructive/15'
            : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'}
        `}
      >
        {icon}
      </span>
      <div className="flex-1 text-left min-w-0">
        <p className={`text-sm font-semibold leading-tight ${danger ? 'text-destructive' : 'text-foreground'}`}>
          {label}
        </p>
        {desc && <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{desc}</p>}
      </div>
      {soon ? (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border tracking-wider uppercase"
          style={{ background: 'hsl(38 95% 52% / 0.12)', color: 'hsl(30 80% 38%)', borderColor: 'hsl(38 95% 52% / 0.3)' }}>
          Soon
        </span>
      ) : (
        !danger && <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0 group-hover:text-primary/50 transition-colors" />
      )}
    </button>
  );
}

/* ─── Divider ────────────────────────────────────────────────────────── */
function MenuDivider() {
  return <div className="mx-4 my-1 h-px bg-border" />;
}

/* ─── Main component ─────────────────────────────────────────────────── */
export function UserMenuDrawer() {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const displayName  = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Guest User';
  const displayEmail = user?.email || null;
  const initials     = displayName.slice(0, 2).toUpperCase();
  // Tier detection — admin email check is a lightweight client-side hint only
  // Real role enforcement always happens server-side (RLS). This just controls UI visibility.
  const isAdmin = !!user; // any logged-in user can access /admin (protected route handles the rest)
  const tier: 'guest' | 'member' | 'admin' = !user ? 'guest' : 'member';

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate('/');
  };

  const handleAdminDashboard = () => {
    setOpen(false);
    navigate('/admin');
  };

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open user menu"
        className="relative flex items-center justify-center w-9 h-9 rounded-full shrink-0 transition-all active:scale-90 hover:ring-2 hover:ring-primary-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/50"
        style={{ background: 'hsl(var(--primary-foreground) / 0.15)', border: '2px solid hsl(var(--primary-foreground) / 0.25)' }}
      >
        {user ? (
          <span className="text-xs font-bold text-primary-foreground leading-none">{initials}</span>
        ) : (
          <User className="w-4 h-4 text-primary-foreground" />
        )}
        {/* Online dot — only for logged-in users */}
        {user && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
            style={{
              background: 'hsl(var(--success))',
              borderColor: 'hsl(var(--primary))',
            }}
          />
        )}
      </button>

      {/* ── Drawer ── */}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-w-lg mx-auto rounded-t-2xl overflow-hidden pb-safe">

          {/* Animated gradient banner */}
          <div
            className="h-2 w-full"
            style={{
              background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--secondary)), hsl(var(--primary)))',
              backgroundSize: '200% 100%',
              animation: 'gradient-shift 3s ease infinite',
            }}
          />

          <DrawerHeader className="sr-only">User Menu</DrawerHeader>

          {/* User identity section */}
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-3.5">
              {/* Avatar */}
              <div
                className="relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-md"
                style={{
                  background: user
                    ? 'linear-gradient(135deg, hsl(var(--primary)), hsl(214 85% 55%))'
                    : 'linear-gradient(135deg, hsl(var(--muted)), hsl(220 15% 80%))',
                }}
              >
                {user ? (
                  <span className="text-xl font-bold text-primary-foreground">{initials}</span>
                ) : (
                  <User className="w-7 h-7 text-muted-foreground" />
                )}
                {user && (
                  <span
                    className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 flex items-center justify-center"
                    style={{ background: 'hsl(var(--success))', borderColor: 'hsl(var(--card))' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  </span>
                )}
              </div>

              {/* Name / status */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-base text-foreground leading-tight truncate">{displayName}</p>
                  <TierBadge tier={tier} />
                </div>
                {displayEmail ? (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{displayEmail}</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">You're in Guest mode</p>
                )}
              </div>
            </div>

            {/* Guest CTA */}
            {!user && (
              <div
                className="mt-3 rounded-xl p-3 flex items-start gap-2.5"
                style={{ background: 'hsl(var(--primary) / 0.07)', border: '1px solid hsl(var(--primary) / 0.15)' }}
              >
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'hsl(var(--primary))' }} />
                <div>
                  <p className="text-xs font-semibold text-foreground leading-tight">Sign in for full access</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    Save shops, get notifications & more
                  </p>
                </div>
              </div>
            )}
          </div>

          <MenuDivider />

          {/* Main menu items */}
          <div className="py-1">
            <MenuRow
              icon={<Bookmark className="w-4 h-4" />}
              label="Saved Shops"
              desc="Your bookmarked local shops"
              soon
            />
            <MenuRow
              icon={<MapPin className="w-4 h-4" />}
              label="My Area"
              desc="Set your preferred neighbourhood"
              soon
            />
            <MenuRow
              icon={<Bell className="w-4 h-4" />}
              label="Notifications"
              desc="New shops & offers near you"
              soon
            />
          </div>

          <MenuDivider />

          <div className="py-1">
            <MenuRow
              icon={<Settings className="w-4 h-4" />}
              label="Settings"
              desc="App preferences"
              soon
            />
            <MenuRow
              icon={<HelpCircle className="w-4 h-4" />}
              label="Help & Feedback"
              desc="Report issues or suggest features"
              soon
            />
            {/* Admin shortcut — navigates to /admin (ProtectedRoute handles access control) */}
            {user && (
              <MenuRow
                icon={<ShieldCheck className="w-4 h-4" />}
                label="Admin Dashboard"
                desc="Manage shops & listings"
                onClick={handleAdminDashboard}
              />
            )}
          </div>

          <MenuDivider />

          {/* Auth actions */}
          <div className="py-1 pb-2">
            {user ? (
              <MenuRow
                icon={<LogOut className="w-4 h-4" />}
                label="Sign Out"
                danger
                onClick={handleSignOut}
              />
            ) : (
              <div className="flex gap-2 px-4 py-2">
                <button
                  onClick={() => { setOpen(false); navigate('/admin/login'); }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                  style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </button>
                <button
                  onClick={() => { setOpen(false); navigate('/admin/login'); }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all active:scale-95"
                  style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))', background: 'hsl(var(--muted))' }}
                >
                  <UserPlus className="w-4 h-4" />
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
