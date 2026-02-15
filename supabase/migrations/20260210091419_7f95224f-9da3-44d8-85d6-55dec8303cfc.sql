-- Drop the unique constraint on route_number to allow same route with different aircraft
ALTER TABLE public.routes DROP CONSTRAINT routes_route_number_key;