
import { createClient } from '@supabase/supabase-js';

// The Supabase URL for project 'wjvcsnuumbtsxfapklkp'
const supabaseUrl = 'https://wjvcsnuumbtsxfapklkp.supabase.co';

// The production JWT key provided in the recent request
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqdmNzbnV1bWJ0c3hmYXBrbGtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3OTk3NjMsImV4cCI6MjA4NTM3NTc2M30.4xX4FwSr4DiZGdUBPZiEXHWt-FExQ6OsPdkGZhwqC3g';

// Initialize the client.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
