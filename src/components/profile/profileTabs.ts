import { Award, BookOpen, Camera, Coins, Crown, Gavel, History, Key, Package, Scale, Settings, Shield, ShoppingBag, Users, Video } from 'lucide-react';

export const PROFILE_TABS = [
  { key: 'social', label: 'Social', icon: Users },
  { key: 'maipiks', label: 'Mai Piks', icon: Camera },
  { key: 'broadcasts', label: 'Broadcasts', icon: Video },
  { key: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
  { key: 'auctions', label: 'Auctions', icon: Gavel },
  { key: 'court', label: 'Court', icon: Scale },
  { key: 'agency', label: 'Agency', icon: Shield },
  { key: 'church', label: 'Church', icon: BookOpen },
  { key: 'subscriptions', label: 'Subscriptions', icon: Crown },
  { key: 'maisub', label: 'MaiSub', icon: Coins },
  { key: 'badges', label: 'Badges', icon: Award },
  { key: 'keys', label: 'Keys', icon: Key },
  { key: 'inventory', label: 'Inventory & Perks', icon: Package },
  { key: 'purchases', label: 'Purchase History', icon: History },
  { key: 'settings', label: 'Settings', icon: Settings },
];
