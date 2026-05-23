-- Add JSONB certificate template to coaching_packages
-- Coaches can design a certificate directly in the platform instead of (or instead of) providing an external URL.
-- The template config drives client-side PDF rendering via html2canvas + jsPDF.

alter table coaching_packages
  add column if not exists certificate_template jsonb;
