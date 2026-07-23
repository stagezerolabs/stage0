import { forwardRef, type SVGProps } from 'react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  AlertTriangle as AlertTriangleIcon,
  ArrowLeftIcon,
  ArrowLeftRightIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  BanIcon,
  Calendar03Icon,
  CalendarIcon,
  Cancel01Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  Clock03Icon,
  ClockIcon,
  Coins01Icon,
  Copy01Icon,
  DiscordIcon,
  DollarIcon,
  ExternalLinkIcon,
  File01Icon,
  FlameIcon,
  GlobeIcon,
  HistoryIcon,
  Image02Icon,
  InformationCircleIcon,
  Layers01Icon,
  Loading03Icon,
  LockIcon,
  Menu01Icon,
  Moon02Icon,
  NewTwitterIcon,
  PackageIcon,
  PercentIcon,
  PinIcon,
  PinOffIcon,
  PlusSignIcon,
  PrinterIcon,
  RefreshCcw as RefreshCcwIcon,
  RocketIcon,
  Search01Icon,
  SentIcon,
  Settings01Icon,
  Shield01Icon,
  ShieldAlert as ShieldAlertIcon,
  ShieldCheck as ShieldCheckIcon,
  ShieldX as ShieldXIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  StarIcon,
  Sun03Icon,
  TargetIcon,
  Timer01Icon,
  ToggleLeft as ToggleLeftIcon,
  ToggleRight as ToggleRightIcon,
  Trash2 as Trash2Icon,
  TrendingUp as TrendingUpIcon,
  Unlock as UnlockIcon,
  Upload01Icon,
  UserGroupIcon,
  UserIcon,
  UserMinusIcon,
  UserPlus as UserPlusIcon,
  ViewIcon,
  Wallet02Icon,
  ZapIcon,
} from '@hugeicons/core-free-icons';

type AppIconProps = SVGProps<SVGSVGElement> & {
  size?: string | number;
  strokeWidth?: number;
  absoluteStrokeWidth?: boolean;
};

const createIcon = (icon: IconSvgElement) =>
  forwardRef<SVGSVGElement, AppIconProps>(({ color = 'currentColor', strokeWidth = 1.8, ...props }, ref) => (
    <HugeiconsIcon ref={ref} icon={icon} color={color} strokeWidth={strokeWidth} {...props} />
  ));

export const AlertTriangle = createIcon(AlertTriangleIcon);
export const ArrowLeft = createIcon(ArrowLeftIcon);
export const ArrowRight = createIcon(ArrowRightIcon);
export const ArrowRightLeft = createIcon(ArrowLeftRightIcon);
export const ArrowUpRight = createIcon(ArrowUpRightIcon);
export const Ban = createIcon(BanIcon);
export const Calendar = createIcon(CalendarIcon);
export const CalendarDays = createIcon(Calendar03Icon);
export const CheckCircle2 = createIcon(CheckmarkCircle02Icon);
export const ChevronDown = createIcon(ChevronDownIcon);
export const ChevronLeft = createIcon(ChevronLeftIcon);
export const ChevronRight = createIcon(ChevronRightIcon);
export const ChevronUp = createIcon(ChevronUpIcon);
export const Clock = createIcon(ClockIcon);
export const Clock3 = createIcon(Clock03Icon);
export const Coins = createIcon(Coins01Icon);
export const Copy = createIcon(Copy01Icon);
export const Discord = createIcon(DiscordIcon);
export const DollarSign = createIcon(DollarIcon);
export const ExternalLink = createIcon(ExternalLinkIcon);
export const FileText = createIcon(File01Icon);
export const Flame = createIcon(FlameIcon);
export const Globe = createIcon(GlobeIcon);
export const History = createIcon(HistoryIcon);
export const Image = createIcon(Image02Icon);
export const Info = createIcon(InformationCircleIcon);
export const Layers = createIcon(Layers01Icon);
export const Loader2 = createIcon(Loading03Icon);
export const Lock = createIcon(LockIcon);
export const Menu = createIcon(Menu01Icon);
export const Moon = createIcon(Moon02Icon);
export const NewTwitter = createIcon(NewTwitterIcon);
export const Package = createIcon(PackageIcon);
export const Percent = createIcon(PercentIcon);
export const Pin = createIcon(PinIcon);
export const PinOff = createIcon(PinOffIcon);
export const Plus = createIcon(PlusSignIcon);
export const Printer = createIcon(PrinterIcon);
export const RefreshCcw = createIcon(RefreshCcwIcon);
export const Rocket = createIcon(RocketIcon);
export const Search = createIcon(Search01Icon);
export const Send = createIcon(SentIcon);
export const Settings = createIcon(Settings01Icon);
export const Shield = createIcon(Shield01Icon);
export const ShieldAlert = createIcon(ShieldAlertIcon);
export const ShieldCheck = createIcon(ShieldCheckIcon);
export const ShieldX = createIcon(ShieldXIcon);
export const Sliders = createIcon(SlidersHorizontalIcon);
export const Sparkles = createIcon(SparklesIcon);
export const Star = createIcon(StarIcon);
export const Sun = createIcon(Sun03Icon);
export const Target = createIcon(TargetIcon);
export const Timer = createIcon(Timer01Icon);
export const ToggleLeft = createIcon(ToggleLeftIcon);
export const ToggleRight = createIcon(ToggleRightIcon);
export const Trash2 = createIcon(Trash2Icon);
export const TrendingUp = createIcon(TrendingUpIcon);
export const Unlock = createIcon(UnlockIcon);
export const Upload = createIcon(Upload01Icon);
export const User = createIcon(UserIcon);
export const UserMinus = createIcon(UserMinusIcon);
export const UserPlus = createIcon(UserPlusIcon);
export const Users = createIcon(UserGroupIcon);
export const View = createIcon(ViewIcon);
export const Wallet = createIcon(Wallet02Icon);
export const X = createIcon(Cancel01Icon);
export const XCircle = createIcon(CancelCircleIcon);
export const Zap = createIcon(ZapIcon);
