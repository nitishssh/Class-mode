import { useState } from "react";
import { Link } from "wouter";
import { Search, Filter, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { getInitials } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface Student {
  id: number;
  name: string;
  profileUrl?: string;
  avatar?: string;
  city: string;
  state: string;
  standard: string;
  section?: string;
}

interface ServerUser {
  id: number;
  name?: string;
  displayName?: string;
  avatar?: string;
  district?: string;
  class?: string;
}

function mapUserToStudent(u: ServerUser): Student {
  return {
    id: u.id,
    name: u.name || u.displayName || "",
    avatar: u.avatar,
    city: u.district || "",
    state: u.district || "",
    standard: u.class || "",
    section: undefined,
  };
}

const standards = [
  "Nursery",
  "LKG",
  "UKG",
  "1st",
  "2nd",
  "3rd",
  "4th",
  "5th",
  "6th",
  "7th",
  "8th",
  "9th",
  "10th",
  "11th",
  "12th",
];

const standardGroups = [
  { id: "pre-primary", name: "Pre-Primary", standards: ["Nursery", "LKG", "UKG"] },
  { id: "primary", name: "Primary", standards: ["1st", "2nd", "3rd", "4th", "5th"] },
  { id: "middle", name: "Middle", standards: ["6th", "7th", "8th"] },
  { id: "secondary", name: "Secondary", standards: ["9th", "10th"] },
  { id: "senior-secondary", name: "Senior Secondary", standards: ["11th", "12th"] },
];

export default function StudentDirectory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStandard, setSelectedStandard] = useState<string>("all");
  const [selectedState, setSelectedState] = useState<string>("all");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");

  // Fetch student data
  const {
    data: rawStudents,
    isLoading,
    isError,
    refetch,
  } = useQuery<ServerUser[]>({
    queryKey: ["/api/users", { role: "student" }],
    queryFn: () => apiRequest("GET", "/api/users?role=student").then((r) => r.json()),
  });

  const students: Student[] = (rawStudents ?? []).map(mapUserToStudent);

  const displayStudents = students;

  // Extract unique states for the filter
  const states = Array.from(new Set(displayStudents.map((student) => student.state))).sort();

  // Filter students based on search term and filters
  const filteredStudents = displayStudents.filter((student) => {
    const matchesSearch =
      searchTerm === "" ||
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.state.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStandard = selectedStandard === "all" || student.standard === selectedStandard;
    const matchesState = selectedState === "all" || student.state === selectedState;

    let matchesGroup = true;
    if (selectedGroup !== "all") {
      const group = standardGroups.find((g) => g.id === selectedGroup);
      matchesGroup = group ? group.standards.includes(student.standard) : true;
    }

    return matchesSearch && matchesStandard && matchesState && matchesGroup;
  });

  return (
    <>
      <Header title="Student Directory" />
      <div className="px-4 py-6 pb-20 md:px-6 md:pb-6 lg:px-8">
        <div className="mb-8">
          <h1 className="mb-2 text-2xl font-bold">Student Directory</h1>
          <p className="text-muted-foreground">
            Browse and search for students across all standards
          </p>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-lg border">
                <Skeleton className="h-48 w-full" />
                <div className="space-y-2 p-4">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="py-12 text-center">
            <p className="mb-4 text-muted-foreground">Failed to load students. Please try again.</p>
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {/* Main content */}
        {!isLoading && !isError && (
          <>
            {/* Search and Filters */}
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="relative md:w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by name, city or state..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Select value={selectedStandard} onValueChange={setSelectedStandard}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Select Standard" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Standards</SelectItem>
                    {standards.map((standard) => (
                      <SelectItem key={standard} value={standard}>
                        {standard}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-1">
                      <Filter className="h-4 w-4" />
                      <span>Filter</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Filter by Standard Group</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={selectedGroup === "all"}
                      onCheckedChange={() => setSelectedGroup("all")}
                    >
                      All Groups
                    </DropdownMenuCheckboxItem>
                    {standardGroups.map((group) => (
                      <DropdownMenuCheckboxItem
                        key={group.id}
                        checked={selectedGroup === group.id}
                        onCheckedChange={() => setSelectedGroup(group.id)}
                      >
                        {group.name}
                      </DropdownMenuCheckboxItem>
                    ))}

                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Filter by State</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={selectedState === "all"}
                      onCheckedChange={() => setSelectedState("all")}
                    >
                      All States
                    </DropdownMenuCheckboxItem>
                    {states.map((state) => (
                      <DropdownMenuCheckboxItem
                        key={state}
                        checked={selectedState === state}
                        onCheckedChange={() => setSelectedState(state)}
                      >
                        {state}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {(selectedStandard !== "all" ||
                  selectedState !== "all" ||
                  selectedGroup !== "all") && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSelectedStandard("all");
                      setSelectedState("all");
                      setSelectedGroup("all");
                    }}
                    className="text-sm"
                  >
                    Reset Filters
                  </Button>
                )}
              </div>
            </div>

            {/* Display by tabs for different grade groups */}
            <Tabs defaultValue="all" className="mb-4">
              <TabsList className="mb-6 flex flex-wrap">
                <TabsTrigger value="all">All Students</TabsTrigger>
                {standardGroups.map((group) => (
                  <TabsTrigger key={group.id} value={group.id}>
                    {group.name}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="all">
                <StudentGrid students={filteredStudents} />
              </TabsContent>

              {standardGroups.map((group) => (
                <TabsContent key={group.id} value={group.id}>
                  <StudentGrid
                    students={filteredStudents.filter((student) =>
                      group.standards.includes(student.standard)
                    )}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </>
        )}
      </div>
      <MobileNav />
    </>
  );
}

function StudentGrid({ students }: { students: Student[] }) {
  if (students.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">No students found matching your criteria</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {students.map((student) => (
        <StudentCard key={student.id} student={student} />
      ))}
    </div>
  );
}

function StudentCard({ student }: { student: Student }) {
  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <div className="flex h-48 items-center justify-center bg-blue-100 dark:bg-blue-900">
        <Avatar className="h-32 w-32">
          {student.avatar ? (
            <AvatarImage src={student.avatar} alt={student.name} />
          ) : (
            <AvatarFallback className="text-2xl">{getInitials(student.name)}</AvatarFallback>
          )}
        </Avatar>
      </div>
      <CardContent className="p-4">
        <h3 className="mb-1 text-lg font-semibold">{student.name}</h3>

        {student.profileUrl && (
          <a
            href={`https://${student.profileUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-2 block truncate text-sm text-muted-foreground hover:underline"
          >
            {student.profileUrl}
          </a>
        )}

        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="default" className="mr-1">
            {student.city}
          </Badge>
          <Badge variant="outline" className="bg-primary/10">
            {student.state}
          </Badge>
        </div>

        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <Badge
            variant="outline"
            className="bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400"
          >
            Class {student.standard}
          </Badge>
          {student.section && (
            <Badge
              variant="outline"
              className="bg-purple-500/10 text-purple-500 dark:bg-purple-500/20 dark:text-purple-400"
            >
              Section {student.section}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
