import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Plus, Trash2, Edit, GraduationCap, BookOpen, ClipboardCheck, Users, FileQuestion, Plane, Eye } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export default function AdminAcademy() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("courses");

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Academy Management</h1>
          <p className="text-muted-foreground">Manage courses, exams, and practicals</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="courses"><BookOpen className="h-4 w-4 mr-1" />Courses</TabsTrigger>
          <TabsTrigger value="exams"><ClipboardCheck className="h-4 w-4 mr-1" />Exams</TabsTrigger>
          <TabsTrigger value="practicals"><GraduationCap className="h-4 w-4 mr-1" />Practicals</TabsTrigger>
          <TabsTrigger value="enrollments"><Users className="h-4 w-4 mr-1" />Enrollments</TabsTrigger>
        </TabsList>

        <TabsContent value="courses"><CoursesTab /></TabsContent>
        <TabsContent value="exams"><ExamsTab /></TabsContent>
        <TabsContent value="practicals"><PracticalsTab /></TabsContent>
        <TabsContent value="enrollments"><EnrollmentsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---- COURSES TAB ---- */
function CoursesTab() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", category: "general", is_published: false, is_required: false, sort_order: 0, thumbnail_url: "" });

  const { data: courses, isLoading } = useQuery({
    queryKey: ["admin-academy-courses"],
    queryFn: async () => {
      const { data } = await supabase.from("academy_courses").select("*").order("sort_order");
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, thumbnail_url: form.thumbnail_url || null };
      if (editId) {
        const { error } = await supabase.from("academy_courses").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("academy_courses").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-academy-courses"] });
      toast.success(editId ? "Course updated" : "Course created");
      closeDialog();
    },
    onError: () => toast.error("Failed to save course"),
  });


  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("academy_courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-academy-courses"] });
      toast.success("Course deleted");
    },
  });

  const closeDialog = () => { setIsOpen(false); setEditId(null); setForm({ title: "", description: "", category: "general", is_published: false, is_required: false, sort_order: 0, thumbnail_url: "" }); };
  const openEdit = (c: any) => { setEditId(c.id); setForm({ title: c.title, description: c.description || "", category: c.category, is_published: c.is_published, is_required: c.is_required, sort_order: c.sort_order, thumbnail_url: c.thumbnail_url || "" }); setIsOpen(true); };

  const [managingCourseId, setManagingCourseId] = useState<string | null>(null);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Courses</CardTitle>
            <CardDescription>{courses?.length || 0} courses</CardDescription>
          </div>
          <Dialog open={isOpen} onOpenChange={(o) => !o && closeDialog()}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditId(null); setForm({ title: "", description: "", category: "general", is_published: false, is_required: false, sort_order: 0, thumbnail_url: "" }); setIsOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Add Course
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editId ? "Edit Course" : "Add Course"}</DialogTitle>
                <DialogDescription>Configure course details</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Course title" /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></div>
                <div className="space-y-2">
                  <Label>Thumbnail / Image URL</Label>
                  <Input value={form.thumbnail_url} onChange={e => setForm({ ...form, thumbnail_url: e.target.value })} placeholder="https://example.com/image.jpg" />
                  {form.thumbnail_url && (
                    <div className="h-24 rounded-lg overflow-hidden border">
                      <img src={form.thumbnail_url} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="initial_training">Initial Training</SelectItem>
                        <SelectItem value="recurrent">Recurrent</SelectItem>
                        <SelectItem value="specialty">Specialty</SelectItem>
                        <SelectItem value="type_rating">Type Rating</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} /></div>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Published</Label>
                  <Switch checked={form.is_published} onCheckedChange={v => setForm({ ...form, is_published: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Required</Label>
                  <Switch checked={form.is_required} onCheckedChange={v => setForm({ ...form, is_required: v })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>{editId ? "Update" : "Create"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-40" /> : courses && courses.length > 0 ? (
            <div className="space-y-3">
              {courses.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3 flex-1">
                    {c.thumbnail_url && (
                      <div className="h-12 w-16 rounded overflow-hidden shrink-0">
                        <img src={c.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{c.title}</span>
                        {c.is_published ? <Badge variant="default">Published</Badge> : <Badge variant="secondary">Draft</Badge>}
                        {c.is_required && <Badge variant="destructive">Required</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">{c.description}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setManagingCourseId(managingCourseId === c.id ? null : c.id)}>
                      <BookOpen className="h-4 w-4 mr-1" /> Content
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(c)}><Edit className="h-4 w-4" /></Button>
                    <ConfirmDialog trigger={<Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>} title="Delete Course?" description="This will permanently delete this course and all its content." onConfirm={() => deleteMutation.mutate(c.id)} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No courses yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {managingCourseId && <CourseContentManager courseId={managingCourseId} />}
    </>
  );
}

/* ---- COURSE CONTENT MANAGER (Modules + Lessons) ---- */
function CourseContentManager({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const [moduleForm, setModuleForm] = useState({ title: "", description: "", sort_order: 0 });
  const [lessonForm, setLessonForm] = useState({ title: "", content: "", video_url: "", image_url: "", sort_order: 0, module_id: "" });
  const [addingModule, setAddingModule] = useState(false);
  const [addingLesson, setAddingLesson] = useState<string | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editLessonForm, setEditLessonForm] = useState({ title: "", content: "", video_url: "", image_url: "", sort_order: 0 });

  const { data: modules } = useQuery({
    queryKey: ["admin-modules", courseId],
    queryFn: async () => {
      const { data } = await supabase.from("academy_modules").select("*").eq("course_id", courseId).order("sort_order");
      return data || [];
    },
  });

  const { data: lessons } = useQuery({
    queryKey: ["admin-lessons", courseId],
    queryFn: async () => {
      if (!modules?.length) return [];
      const { data } = await supabase.from("academy_lessons").select("*").in("module_id", modules.map(m => m.id)).order("sort_order");
      return data || [];
    },
    enabled: !!modules?.length,
  });

  const addModuleMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("academy_modules").insert({ ...moduleForm, course_id: courseId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-modules", courseId] });
      toast.success("Module added");
      setAddingModule(false);
      setModuleForm({ title: "", description: "", sort_order: 0 });
    },
  });

  const deleteModuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("academy_modules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-modules", courseId] });
      toast.success("Module deleted");
    },
  });

  const addLessonMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("academy_lessons").insert({
        title: lessonForm.title,
        content: lessonForm.content,
        video_url: lessonForm.video_url || null,
        image_url: (lessonForm as any).image_url || null,
        sort_order: lessonForm.sort_order,
        module_id: lessonForm.module_id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-lessons", courseId] });
      toast.success("Lesson added");
      setAddingLesson(null);
      setLessonForm({ title: "", content: "", video_url: "", image_url: "", sort_order: 0, module_id: "" });
    },
  });


  const updateLessonMutation = useMutation({
    mutationFn: async () => {
      if (!editingLessonId) throw new Error("No lesson selected");
      const { error } = await supabase.from("academy_lessons").update({
        title: editLessonForm.title,
        content: editLessonForm.content,
        video_url: editLessonForm.video_url || null,
        image_url: (editLessonForm as any).image_url || null,
        sort_order: editLessonForm.sort_order,
      } as any).eq("id", editingLessonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-lessons", courseId] });
      toast.success("Lesson updated");
      setEditingLessonId(null);
    },
    onError: (e: any) => toast.error(e.message || "Failed to update lesson"),
  });

  const deleteLessonMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("academy_lessons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-lessons", courseId] });
      toast.success("Lesson deleted");
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Course Content</CardTitle>
        <Button size="sm" onClick={() => setAddingModule(true)}>
          <Plus className="h-4 w-4 mr-1" /> Module
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {addingModule && (
          <div className="p-3 border rounded-lg space-y-2">
            <Input placeholder="Module title" value={moduleForm.title} onChange={e => setModuleForm({ ...moduleForm, title: e.target.value })} />
            <Input type="number" placeholder="Sort order" value={moduleForm.sort_order} onChange={e => setModuleForm({ ...moduleForm, sort_order: parseInt(e.target.value) || 0 })} />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => addModuleMutation.mutate()}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => setAddingModule(false)}>Cancel</Button>
            </div>
          </div>
        )}
        {modules?.map(mod => (
          <div key={mod.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">{mod.title}</h4>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => { setAddingLesson(mod.id); setLessonForm({ ...lessonForm, module_id: mod.id }); }}>
                  <Plus className="h-3 w-3 mr-1" /> Lesson
                </Button>
                <ConfirmDialog trigger={<Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"><Trash2 className="h-3 w-3" /></Button>} title="Delete Module?" description="This will delete the module and all its lessons." onConfirm={() => deleteModuleMutation.mutate(mod.id)} />
              </div>
            </div>
            {addingLesson === mod.id && (
            <div className="pl-4 p-3 border-l-2 space-y-2">
                <Input placeholder="Lesson title" value={lessonForm.title} onChange={e => setLessonForm({ ...lessonForm, title: e.target.value })} />
                <Textarea placeholder="Lesson content (markdown)" value={lessonForm.content} onChange={e => setLessonForm({ ...lessonForm, content: e.target.value })} rows={6} />
                <p className="text-xs text-muted-foreground">Supports markdown. Add images anywhere with <code>![alt](https://image-url)</code> or paste a direct image URL on its own line.</p>
                <Input placeholder="Video URL (optional)" value={lessonForm.video_url} onChange={e => setLessonForm({ ...lessonForm, video_url: e.target.value })} />
                <Input placeholder="Image URL (optional)" value={(lessonForm as any).image_url || ""} onChange={e => setLessonForm({ ...lessonForm, image_url: e.target.value } as any)} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => addLessonMutation.mutate()}>Save Lesson</Button>
                  <Button size="sm" variant="outline" onClick={() => setAddingLesson(null)}>Cancel</Button>
                </div>
              </div>
            )}
            <div className="pl-4 space-y-1">
              {lessons?.filter(l => l.module_id === mod.id).map(lesson => (
                <div key={lesson.id} className="py-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span>{lesson.title}</span>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                        setEditingLessonId(editingLessonId === lesson.id ? null : lesson.id);
                        setEditLessonForm({
                          title: lesson.title || "",
                          content: lesson.content || "",
                          video_url: (lesson as any).video_url || "",
                          image_url: (lesson as any).image_url || "",
                          sort_order: lesson.sort_order || 0,
                        });
                      }}><Edit className="h-3 w-3" /></Button>
                      <ConfirmDialog trigger={<Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"><Trash2 className="h-3 w-3" /></Button>} title="Delete Lesson?" description="This lesson will be permanently deleted." onConfirm={() => deleteLessonMutation.mutate(lesson.id)} />
                    </div>
                  </div>
                  {editingLessonId === lesson.id && (
                    <div className="mt-2 p-2 border rounded space-y-2">
                      <Input placeholder="Lesson title" value={editLessonForm.title} onChange={e => setEditLessonForm({ ...editLessonForm, title: e.target.value })} />
                      <Textarea placeholder="Lesson content" value={editLessonForm.content} onChange={e => setEditLessonForm({ ...editLessonForm, content: e.target.value })} rows={5} />
                      <Input placeholder="Video URL (optional)" value={editLessonForm.video_url} onChange={e => setEditLessonForm({ ...editLessonForm, video_url: e.target.value })} />
                      <Input placeholder="Image URL (optional)" value={(editLessonForm as any).image_url || ""} onChange={e => setEditLessonForm({ ...editLessonForm, image_url: e.target.value } as any)} />
                      <Input type="number" placeholder="Sort order" value={editLessonForm.sort_order} onChange={e => setEditLessonForm({ ...editLessonForm, sort_order: parseInt(e.target.value) || 0 })} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => updateLessonMutation.mutate()} disabled={updateLessonMutation.isPending}>Update Lesson</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingLessonId(null)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {!modules?.length && !addingModule && (
          <p className="text-sm text-muted-foreground text-center py-4">No modules yet. Add a module to get started.</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ---- EXAMS TAB ---- */
function ExamsTab() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", course_id: "standalone", passing_score: 70, time_limit_minutes: 30, max_attempts: 3, is_published: false });
  const [managingExamId, setManagingExamId] = useState<string | null>(null);
  const [viewingResultsExamId, setViewingResultsExamId] = useState<string | null>(null);

  const { data: courses } = useQuery({
    queryKey: ["admin-academy-courses"],
    queryFn: async () => {
      const { data } = await supabase.from("academy_courses").select("id, title").order("title");
      return data || [];
    },
  });

  const { data: exams, isLoading } = useQuery({
    queryKey: ["admin-academy-exams"],
    queryFn: async () => {
      const { data } = await supabase.from("academy_exams").select("*, academy_courses(title)").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("academy_exams").insert({
        title: form.title,
        description: form.description,
        course_id: form.course_id === "standalone" ? null : form.course_id,
        passing_score: form.passing_score,
        time_limit_minutes: form.time_limit_minutes || null,
        max_attempts: form.max_attempts,
        is_published: form.is_published,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-academy-exams"] });
      toast.success("Exam created");
      setIsOpen(false);
    },
    onError: () => toast.error("Failed to create exam"),
  });


  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("academy_exams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-academy-exams"] });
      toast.success("Exam deleted");
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, is_published }: { id: string; is_published: boolean }) => {
      const { error } = await supabase.from("academy_exams").update({ is_published }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-academy-exams"] });
      toast.success("Exam updated");
    },
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle>Exams</CardTitle><CardDescription>{exams?.length || 0} exams</CardDescription></div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Add Exam</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Exam</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
                <div className="space-y-2">
                  <Label>Course (optional)</Label>
                  <Select value={form.course_id} onValueChange={v => setForm({ ...form, course_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Standalone exam" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standalone">Standalone exam (not linked to course)</SelectItem>
                      {courses?.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 grid-cols-3">
                  <div className="space-y-2"><Label>Pass %</Label><Input type="number" value={form.passing_score} onChange={e => setForm({ ...form, passing_score: parseInt(e.target.value) || 70 })} /></div>
                  <div className="space-y-2"><Label>Time (min)</Label><Input type="number" value={form.time_limit_minutes} onChange={e => setForm({ ...form, time_limit_minutes: parseInt(e.target.value) || 0 })} /></div>
                  <div className="space-y-2"><Label>Max Attempts</Label><Input type="number" value={form.max_attempts} onChange={e => setForm({ ...form, max_attempts: parseInt(e.target.value) || 3 })} /></div>
                </div>
                <div className="flex items-center justify-between"><Label>Published</Label><Switch checked={form.is_published} onCheckedChange={v => setForm({ ...form, is_published: v })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-40" /> : exams && exams.length > 0 ? (
            <div className="space-y-3">
              {exams.map((exam: any) => (
                <div key={exam.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{exam.title}</span>
                      {exam.is_published ? <Badge>Published</Badge> : <Badge variant="secondary">Draft</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{exam.academy_courses?.title || "Standalone Exam"} · {exam.passing_score}% pass · {exam.max_attempts} attempts</p>
                  </div>
                  <div className="flex gap-1 items-center">
                    <div className="flex items-center gap-1 mr-2">
                      <Switch
                        checked={exam.is_published}
                        onCheckedChange={(v) => togglePublishMutation.mutate({ id: exam.id, is_published: v })}
                      />
                      <span className="text-xs text-muted-foreground">{exam.is_published ? "Published" : "Draft"}</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setViewingResultsExamId(viewingResultsExamId === exam.id ? null : exam.id)}>
                      <Eye className="h-4 w-4 mr-1" /> Results
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setManagingExamId(managingExamId === exam.id ? null : exam.id)}>
                      <FileQuestion className="h-4 w-4 mr-1" /> Questions
                    </Button>
                    <ConfirmDialog trigger={<Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>} title="Delete Exam?" description="This will permanently delete this exam and all its questions." onConfirm={() => deleteMutation.mutate(exam.id)} />
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-center py-8 text-muted-foreground">No exams yet</p>}
        </CardContent>
      </Card>

      {viewingResultsExamId && <ExamResultsViewer examId={viewingResultsExamId} />}
      {managingExamId && <ExamQuestionsManager examId={managingExamId} />}
    </>
  );
}

/* ---- EXAM RESULTS VIEWER ---- */
function ExamResultsViewer({ examId }: { examId: string }) {
  const { data: attempts, isLoading } = useQuery({
    queryKey: ["admin-exam-attempts", examId],
    queryFn: async () => {
      const { data } = await supabase
        .from("academy_exam_attempts")
        .select("*, pilots!academy_exam_attempts_pilot_id_fkey(pid, full_name)")
        .eq("exam_id", examId)
        .order("started_at", { ascending: false });
      return data || [];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Exam Results ({attempts?.length || 0})</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-40" /> : attempts && attempts.length > 0 ? (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b">
                <th className="text-left py-3 px-2 font-medium">Pilot</th>
                <th className="text-left py-3 px-2 font-medium">Score</th>
                <th className="text-left py-3 px-2 font-medium">Result</th>
                <th className="text-left py-3 px-2 font-medium">Date</th>
              </tr></thead>
              <tbody>
                {attempts.map((a: any) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="py-3 px-2">{a.pilots?.full_name} ({a.pilots?.pid})</td>
                    <td className="py-3 px-2 font-mono">{a.score !== null ? `${a.score}%` : "—"}</td>
                    <td className="py-3 px-2">
                      {a.completed_at ? (
                        <Badge variant={a.passed ? "default" : "destructive"}>{a.passed ? "Passed" : "Failed"}</Badge>
                      ) : (
                        <Badge variant="secondary">In Progress</Badge>
                      )}
                    </td>
                    <td className="py-3 px-2 text-muted-foreground">{a.started_at ? new Date(a.started_at).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-center py-4 text-sm text-muted-foreground">No attempts yet</p>}
      </CardContent>
    </Card>
  );
}

/* ---- EXAM QUESTIONS MANAGER ---- */
function ExamQuestionsManager({ examId }: { examId: string }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ question: "", options: [{ text: "", is_correct: false }, { text: "", is_correct: false }, { text: "", is_correct: false }, { text: "", is_correct: false }], explanation: "" });
  const [adding, setAdding] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const { data: questions } = useQuery({
    queryKey: ["admin-exam-questions", examId],
    queryFn: async () => {
      const { data } = await supabase.from("academy_exam_questions").select("*").eq("exam_id", examId).order("sort_order");
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const validOptions = form.options.filter(o => o.text.trim());
      if (validOptions.length < 2) throw new Error("At least 2 options required");
      if (!validOptions.some(o => o.is_correct)) throw new Error("Mark a correct answer");
      const { error } = await supabase.from("academy_exam_questions").insert({
        exam_id: examId,
        question: form.question,
        options: validOptions,
        explanation: form.explanation || null,
        sort_order: (questions?.length || 0),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-exam-questions", examId] });
      toast.success("Question added");
      setAdding(false);
      setForm({ question: "", options: [{ text: "", is_correct: false }, { text: "", is_correct: false }, { text: "", is_correct: false }, { text: "", is_correct: false }], explanation: "" });
    },
    onError: (e) => toast.error(e.message || "Failed to add question"),
  });


  const updateQuestionMutation = useMutation({
    mutationFn: async ({ id, question, options, explanation }: any) => {
      const validOptions = options.filter((o: any) => o.text.trim());
      if (validOptions.length < 2) throw new Error("At least 2 options required");
      if (!validOptions.some((o: any) => o.is_correct)) throw new Error("Mark a correct answer");
      const { error } = await supabase.from("academy_exam_questions").update({
        question,
        options: validOptions,
        explanation: explanation || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-exam-questions", examId] });
      toast.success("Question updated");
      setEditingQuestionId(null);
    },
    onError: (e: any) => toast.error(e.message || "Failed to update question"),
  });


  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("academy_exam_questions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-exam-questions", examId] });
      toast.success("Question deleted");
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Exam Questions ({questions?.length || 0})</CardTitle>
        <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1" /> Question</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <div className="p-3 border rounded-lg space-y-3">
            <Input placeholder="Question text" value={form.question} onChange={e => setForm({ ...form, question: e.target.value })} />
            <div className="space-y-2">
              <Label className="text-xs">Options (check the correct one)</Label>
              {form.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="radio" name="correct" checked={opt.is_correct} onChange={() => setForm({ ...form, options: form.options.map((o, j) => ({ ...o, is_correct: j === i })) })} />
                  <Input placeholder={`Option ${i + 1}`} value={opt.text} onChange={e => setForm({ ...form, options: form.options.map((o, j) => j === i ? { ...o, text: e.target.value } : o) })} />
                </div>
              ))}
            </div>
            <Input placeholder="Explanation (optional)" value={form.explanation} onChange={e => setForm({ ...form, explanation: e.target.value })} />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => addMutation.mutate()}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </div>
        )}
        {questions?.map((q: any, idx: number) => (
          <div key={q.id} className="p-2 bg-muted/50 rounded text-sm space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">Q{idx + 1}: {q.question}</p>
                <div className="text-xs text-muted-foreground mt-1">
                  {(q.options as any[]).map((o: any, i: number) => (
                    <span key={i} className={o.is_correct ? "text-green-500 font-medium" : ""}>{o.text}{i < q.options.length - 1 ? " · " : ""}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setEditingQuestionId(editingQuestionId === q.id ? null : q.id)}><Edit className="h-3 w-3" /></Button>
                <ConfirmDialog trigger={<Button size="icon" variant="ghost" className="h-6 w-6 text-destructive shrink-0"><Trash2 className="h-3 w-3" /></Button>} title="Delete Question?" description="This question will be permanently deleted." onConfirm={() => deleteMutation.mutate(q.id)} />
              </div>
            </div>
            {editingQuestionId === q.id && (
              <QuestionEditForm
                initial={q}
                onCancel={() => setEditingQuestionId(null)}
                onSave={(payload) => updateQuestionMutation.mutate({ id: q.id, ...payload })}
                isSaving={updateQuestionMutation.isPending}
              />
            )}
          </div>
        ))}
        {!questions?.length && !adding && <p className="text-center text-sm text-muted-foreground py-4">No questions yet</p>}
      </CardContent>
    </Card>
  );
}

function QuestionEditForm({ initial, onCancel, onSave, isSaving }: { initial: any; onCancel: () => void; onSave: (payload: any) => void; isSaving: boolean }) {
  const [question, setQuestion] = useState(initial.question || "");
  const [explanation, setExplanation] = useState(initial.explanation || "");
  const [options, setOptions] = useState((initial.options || [{ text: "", is_correct: false }, { text: "", is_correct: false }, { text: "", is_correct: false }, { text: "", is_correct: false }]).map((o: any) => ({ text: o.text || "", is_correct: !!o.is_correct })));

  return (
    <div className="border rounded p-2 space-y-2">
      <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Question text" />
      {options.map((opt: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <input type="radio" name={`correct-${initial.id}`} checked={opt.is_correct} onChange={() => setOptions(options.map((o: any, j: number) => ({ ...o, is_correct: j === i })))} />
          <Input value={opt.text} onChange={(e) => setOptions(options.map((o: any, j: number) => (j === i ? { ...o, text: e.target.value } : o)))} placeholder={`Option ${i + 1}`} />
        </div>
      ))}
      <Input value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Explanation (optional)" />
      <div className="flex gap-2">
        <Button size="sm" disabled={isSaving} onClick={() => onSave({ question, options, explanation })}>Save</Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

/* ---- PRACTICALS TAB ---- */
function PracticalsTab() {
  const queryClient = useQueryClient();
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ pilot_id: "", course_id: "", notes: "", scheduled_at: "" });
  const [failReasonId, setFailReasonId] = useState<string | null>(null);
  const [failReason, setFailReason] = useState("");

  const { data: practicals, isLoading } = useQuery({
    queryKey: ["admin-practicals"],
    queryFn: async () => {
      const { data } = await supabase.from("academy_practicals").select("*, pilots!academy_practicals_pilot_id_fkey(pid, full_name), academy_courses(title)").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: pilots } = useQuery({
    queryKey: ["admin-pilots-list"],
    queryFn: async () => {
      const { data } = await supabase.from("pilots").select("id, pid, full_name").order("full_name");
      return data || [];
    },
  });

  const { data: courses } = useQuery({
    queryKey: ["admin-academy-courses"],
    queryFn: async () => {
      const { data } = await supabase.from("academy_courses").select("id, title").order("title");
      return data || [];
    },
  });

  const { data: aircraft } = useQuery({
    queryKey: ["aircraft-list"],
    queryFn: async () => {
      const { data } = await supabase.from("aircraft").select("*").order("name");
      return data || [];
    },
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!assignForm.pilot_id || !assignForm.course_id) throw new Error("Select pilot and course");
      const { error } = await supabase.from("academy_practicals").insert({
        pilot_id: assignForm.pilot_id,
        course_id: assignForm.course_id,
        notes: assignForm.notes || null,
        scheduled_at: assignForm.scheduled_at || null,
        status: "scheduled",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-practicals"] });
      toast.success("Practical assigned");
      setIsAssignOpen(false);
      setAssignForm({ pilot_id: "", course_id: "", notes: "", scheduled_at: "" });
    },
    onError: (e) => toast.error(e.message || "Failed to assign practical"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, result_notes }: { id: string; status: string; result_notes?: string }) => {
      const { error } = await supabase.from("academy_practicals").update({
        status,
        result_notes: result_notes || null,
        completed_at: ["passed", "failed"].includes(status) ? new Date().toISOString() : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-practicals"] });
      toast.success("Practical updated");
    },
  });


  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("academy_practicals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-practicals"] });
      toast.success("Practical deleted");
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Practicals / Check Rides</CardTitle>
          <CardDescription>Assign and manage practical assessments</CardDescription>
        </div>
        <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Assign Practical</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Assign Practical Flight</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Pilot</Label>
                <Select value={assignForm.pilot_id} onValueChange={v => setAssignForm({ ...assignForm, pilot_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select pilot" /></SelectTrigger>
                  <SelectContent>
                    {pilots?.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.pid})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Course</Label>
                <Select value={assignForm.course_id} onValueChange={v => setAssignForm({ ...assignForm, course_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                  <SelectContent>
                    {courses?.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Scheduled Date/Time</Label>
                <Input type="datetime-local" value={assignForm.scheduled_at} onChange={e => setAssignForm({ ...assignForm, scheduled_at: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Notes / Instructions</Label>
                <Textarea value={assignForm.notes} onChange={e => setAssignForm({ ...assignForm, notes: e.target.value })} placeholder="e.g. Origin: UUEE, Destination: EGLL, Aircraft: A359" rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAssignOpen(false)}>Cancel</Button>
              <Button onClick={() => assignMutation.mutate()} disabled={assignMutation.isPending}>Assign</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-40" /> : practicals && practicals.length > 0 ? (
          <div className="space-y-3">
            {practicals.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{p.pilots?.full_name} ({p.pilots?.pid})</p>
                  <p className="text-xs text-muted-foreground">{p.academy_courses?.title}</p>
                  {p.notes && <p className="text-xs text-muted-foreground mt-1 italic">{p.notes}</p>}
                  {p.scheduled_at && <p className="text-xs text-muted-foreground">Scheduled: {new Date(p.scheduled_at).toLocaleString()}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={p.status === "passed" ? "default" : p.status === "failed" ? "destructive" : "secondary"}>{p.status}</Badge>
                  {(p.status === "scheduled" || p.status === "completed") && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: p.id, status: "passed" })}>Pass</Button>
                      {failReasonId === p.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            placeholder="Fail reason..."
                            value={failReason}
                            onChange={e => setFailReason(e.target.value)}
                            className="h-8 w-40 text-xs"
                          />
                          <Button size="sm" variant="destructive" onClick={() => {
                            updateMutation.mutate({ id: p.id, status: "failed", result_notes: failReason });
                            setFailReasonId(null);
                            setFailReason("");
                          }}>Confirm</Button>
                          <Button size="sm" variant="ghost" onClick={() => { setFailReasonId(null); setFailReason(""); }}>✕</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="destructive" onClick={() => setFailReasonId(p.id)}>Fail</Button>
                      )}
                    </>
                  )}
                  {p.result_notes && <span className="text-xs text-muted-foreground italic max-w-[150px] truncate">{p.result_notes}</span>}
                  <ConfirmDialog trigger={<Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>} title="Delete Practical?" description="This practical assignment will be permanently deleted." onConfirm={() => deleteMutation.mutate(p.id)} />
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-center py-8 text-muted-foreground">No practicals scheduled</p>}
      </CardContent>
    </Card>
  );
}

/* ---- ENROLLMENTS TAB ---- */
function EnrollmentsTab() {
  const { data: enrollments, isLoading } = useQuery({
    queryKey: ["admin-enrollments"],
    queryFn: async () => {
      const { data } = await supabase.from("academy_enrollments").select("*, pilots(pid, full_name), academy_courses(title)").order("enrolled_at", { ascending: false });
      return data || [];
    },
  });

  return (
    <Card>
      <CardHeader><CardTitle>Enrollments</CardTitle><CardDescription>All pilot enrollments</CardDescription></CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-40" /> : enrollments && enrollments.length > 0 ? (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b">
                <th className="text-left py-3 px-2 font-medium">Pilot</th>
                <th className="text-left py-3 px-2 font-medium">Course</th>
                <th className="text-left py-3 px-2 font-medium">Status</th>
                <th className="text-left py-3 px-2 font-medium">Enrolled</th>
              </tr></thead>
              <tbody>
                {enrollments.map((e: any) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="py-3 px-2">{e.pilots?.full_name} ({e.pilots?.pid})</td>
                    <td className="py-3 px-2">{e.academy_courses?.title}</td>
                    <td className="py-3 px-2"><Badge variant="secondary">{e.status}</Badge></td>
                    <td className="py-3 px-2 text-muted-foreground">{new Date(e.enrolled_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-center py-8 text-muted-foreground">No enrollments yet</p>}
      </CardContent>
    </Card>
  );
}
