create policy "hospital admin update own hospital"
on public.hospitals
for update
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or (
    public.has_role(auth.uid(), 'hospital_admin')
    and id = public.current_hospital_id()
  )
)
with check (
  public.has_role(auth.uid(), 'admin')
  or (
    public.has_role(auth.uid(), 'hospital_admin')
    and id = public.current_hospital_id()
  )
);
