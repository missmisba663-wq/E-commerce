import {
  Baby, Car, Dumbbell, FlaskConical, Gamepad2, Hammer, Headphones, HeartPulse, HouseWifi, Laptop, LayoutGrid,
  Luggage, Palette, PawPrint, Puzzle, Shirt, Sofa, Sparkles,
} from 'lucide-react';

const ICONS = {
  shirt: Shirt,
  headphones: Headphones,
  laptop: Laptop,
  'house-wifi': HouseWifi,
  gamepad: Gamepad2,
  puzzle: Puzzle,
  sofa: Sofa,
  sparkles: Sparkles,
  'heart-pulse': HeartPulse,
  baby: Baby,
  dumbbell: Dumbbell,
  'paw-print': PawPrint,
  luggage: Luggage,
  car: Car,
  hammer: Hammer,
  palette: Palette,
  flask: FlaskConical,
};

export default function DeptIcon({ name, size = 20, ...rest }) {
  const Icon = ICONS[name] || LayoutGrid;
  return <Icon size={size} {...rest} />;
}
