import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';

export const formatThaiDate = (date) => {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISO(date) : date;
  // Convert year to Buddhist Era (+543)
  const formatted = format(d, 'd MMMM yyyy', { locale: th });
  const [day, month, year] = formatted.split(' ');
  return `${day} ${month} ${parseInt(year) + 543}`;
};

export const formatThaiTime = (date) => {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'HH:mm น.', { locale: th });
};

export const getCurrentISODate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
