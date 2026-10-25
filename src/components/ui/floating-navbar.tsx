"use client";

import React, { useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "motion/react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export interface NavItem {
  name: string;
  link: string;
  icon?: React.ReactNode;
}

export interface FloatingNavProps {
  navItems: NavItem[];
  className?: string;
  children?: React.ReactNode;
}

export function FloatingNav({
  navItems,
  className,
  children,
}: FloatingNavProps) {
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(true);

  useMotionValueEvent(scrollY, "change", (current) => {
    if (typeof current === "number") {
      const prev = scrollY.getPrevious() ?? 0;
      const direction = current - prev;

      // Always visible when near the top of the page
      if (current < 50) {
        setVisible(true);
      } else {
        // Scrolling up reveals, scrolling down hides
        if (direction < 0) {
          setVisible(true);
        } else if (direction > 4) {
          setVisible(false);
        }
      }
    }
  });

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{
          opacity: 1,
          y: 0,
        }}
        animate={{
          y: visible ? 0 : -100,
          opacity: visible ? 1 : 0,
        }}
        transition={{
          duration: 0.25,
          ease: "easeInOut",
        }}
        className={cn(
          "flex max-w-fit fixed top-6 inset-x-0 mx-auto border border-[#E5DFD2] rounded-full bg-white/95 backdrop-blur-md shadow-md z-[5000] px-4 py-2 items-center justify-center space-x-4",
          className
        )}
      >
        {navItems.map((navItem, idx) => (
          <Link
            key={`link-${idx}`}
            href={navItem.link}
            className="relative text-[#576563] hover:text-[#0D4A52] items-center flex space-x-1.5 text-xs sm:text-sm font-medium transition-colors"
          >
            {navItem.icon && <span className="block">{navItem.icon}</span>}
            <span className="block">{navItem.name}</span>
          </Link>
        ))}

        {children}
      </motion.div>
    </AnimatePresence>
  );
}
