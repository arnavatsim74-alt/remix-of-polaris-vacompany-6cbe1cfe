import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { GraduationCap, BookOpen, Clock, CheckCircle, ArrowRight } from "lucide-react";

export default function Academy() {
  const { pilot } = useAuth();
  const navigate = useNavigate();

  const { data: courses, isLoading } = useQuery({
    queryKey: ["academy-courses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("academy_courses")
        .select("*")
        .eq("is_published", true)
        .order("sort_order");
      return data || [];
    },
  });

  const { data: enrollments } = useQuery({
    queryKey: ["academy-enrollments", pilot?.id],
    queryFn: async () => {
      if (!pilot?.id) return [];
      const { data } = await supabase
        .from("academy_enrollments")
        .select("*")
        .eq("pilot_id", pilot.id);
      return data || [];
    },
    enabled: !!pilot?.id,
  });

  const { data: modules } = useQuery({
    queryKey: ["academy-all-modules"],
    queryFn: async () => {
      const { data } = await supabase.from("academy_modules").select("id, course_id");
      return data || [];
    },
  });

  const { data: lessons } = useQuery({
    queryKey: ["academy-all-lessons"],
    queryFn: async () => {
      const { data } = await supabase.from("academy_lessons").select("id, module_id");
      return data || [];
    },
  });

  const { data: progress } = useQuery({
    queryKey: ["academy-progress", pilot?.id],
    queryFn: async () => {
      if (!pilot?.id) return [];
      const { data } = await supabase
        .from("academy_lesson_progress")
        .select("lesson_id")
        .eq("pilot_id", pilot.id);
      return data || [];
    },
    enabled: !!pilot?.id,
  });

  const getCourseProgress = (courseId: string) => {
    const courseModuleIds = modules?.filter(m => m.course_id === courseId).map(m => m.id) || [];
    const courseLessonIds = lessons?.filter(l => courseModuleIds.includes(l.module_id)).map(l => l.id) || [];
    const completedCount = progress?.filter(p => courseLessonIds.includes(p.lesson_id)).length || 0;
    const total = courseLessonIds.length;
    return total > 0 ? Math.round((completedCount / total) * 100) : 0;
  };

  const isEnrolled = (courseId: string) => enrollments?.some(e => e.course_id === courseId);
  const getEnrollment = (courseId: string) => enrollments?.find(e => e.course_id === courseId);

  const categoryLabels: Record<string, string> = {
    general: "General",
    initial_training: "Initial Training",
    recurrent: "Recurrent",
    specialty: "Specialty",
    type_rating: "Type Rating",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Crew Center Academy</h1>
          <p className="text-muted-foreground">Browse courses, take exams, and advance your career</p>
        </div>
      </div>

      {/* Enrolled Courses */}
      {enrollments && enrollments.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">My Courses</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {enrollments.map(enrollment => {
              const course = courses?.find(c => c.id === enrollment.course_id);
              if (!course) return null;
              const prog = getCourseProgress(course.id);
              return (
                <Card key={enrollment.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/academy/course/${course.id}`)}>
                  {course.thumbnail_url && (
                    <div className="h-32 overflow-hidden rounded-t-lg">
                      <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">{categoryLabels[course.category] || course.category}</Badge>
                      {enrollment.status === "completed" && <CheckCircle className="h-4 w-4 text-green-500" />}
                    </div>
                    <CardTitle className="text-base line-clamp-1">{course.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Progress value={prog} className="h-2" />
                    <p className="text-xs text-muted-foreground">{prog}% complete</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* All Courses */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">All Courses</h2>
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-60" />)}
          </div>
        ) : courses && courses.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses.map(course => {
              const enrolled = isEnrolled(course.id);
              return (
                <Card key={course.id} className="overflow-hidden">
                  {course.thumbnail_url ? (
                    <div className="h-36 overflow-hidden">
                      <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="h-36 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <BookOpen className="h-12 w-12 text-primary/30" />
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{categoryLabels[course.category] || course.category}</Badge>
                      {course.is_required && <Badge variant="destructive">Required</Badge>}
                    </div>
                    <CardTitle className="text-base">{course.title}</CardTitle>
                    <CardDescription className="line-clamp-2">{course.description || "No description"}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full"
                      variant={enrolled ? "outline" : "default"}
                      onClick={() => navigate(`/academy/course/${course.id}`)}
                    >
                      {enrolled ? "Continue" : "View Course"}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No courses available yet</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
