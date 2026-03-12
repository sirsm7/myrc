/**
 * ============================================================================
 * GLOBAL CONFIGURATION MODULE
 * ============================================================================
 * This file contains all the global constants, API endpoint URLs, and the 
 * initialization logic for the Supabase backend client.
 * Ensure this script is loaded BEFORE any other custom scripts in your HTML.
 * ============================================================================
 */

// 1. Supabase Backend Credentials
const SUPABASE_URL = 'https://app.tech4ag.my';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYzMzczNjQ1LCJleHAiOjIwNzg3MzM2NDV9.vZOedqJzUn01PjwfaQp7VvRzSm4aRMr21QblPDK8AoY';

// 2. Google Apps Script (GAS) Endpoint for File Uploads
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbwyuAsbzxkIbE2ib3GOi9fDpau2KIMzm-YnCbwgwzA4zFlgfVzYt61liHm-d58EPUOO/exec';

// 3. Product Pricing Structure
const PRICE_MIKRO = 90;
const PRICE_AI = 100;

// 4. Initialize Supabase Client
// Note: The global `supabase` object is provided by the Supabase JS CDN loaded in the HTML head.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * ============================================================================
 * END OF CONFIGURATION
 * ============================================================================
 */