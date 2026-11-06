-- Security Advisor: pin the search path of every function, this one included.
alter function layar.max_phones() set search_path = '';
