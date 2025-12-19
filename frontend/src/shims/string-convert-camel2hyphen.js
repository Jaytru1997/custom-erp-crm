export default function camel2hyphen(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}


