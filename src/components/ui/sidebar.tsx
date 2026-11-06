"use client";
import { cn } from "@/lib/utils";
import Link, { LinkProps } from "next/link";
import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, motion } from "motion/react";
import { IconMenu2, IconX } from "@tabler/icons-react";

export interface Links {
  label: string;
  href?: string;
  onClick?: () => void;
  icon: React.JSX.Element | React.ReactNode;
  badge?: React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar {...(props as React.ComponentProps<"div">)} />
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <motion.div
      className={cn(
        "h-full px-4 py-4 hidden md:flex md:flex-col bg-white/95 backdrop-blur-md border-r border-[#E5DFD2] w-[260px] shrink-0",
        className
      )}
      animate={{
        width: animate ? (open ? "260px" : "68px") : "260px",
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar();
  return (
    <div
      className={cn(
        "h-14 px-4 flex flex-row md:hidden items-center justify-between bg-white/95 backdrop-blur-md border-b border-[#E5DFD2] w-full"
      )}
      {...props}
    >
      <div className="flex justify-end z-20 w-full">
        <IconMenu2
          className="text-neutral-800 cursor-pointer"
          onClick={() => setOpen(!open)}
        />
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{
              duration: 0.3,
              ease: "easeInOut",
            }}
            className={cn(
              "fixed h-full w-full inset-0 bg-white/98 backdrop-blur-xl p-8 z-[100] flex flex-col justify-between",
              className
            )}
          >
            <div
              className="absolute right-6 top-6 z-50 text-neutral-800 cursor-pointer p-2"
              onClick={() => setOpen(!open)}
            >
              <IconX />
            </div>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const SidebarLink = ({
  link,
  className,
  active,
  onClick,
  ...props
}: {
  link: Links;
  className?: string;
  active?: boolean;
  onClick?: () => void;
  props?: LinkProps;
}) => {
  const { open, animate } = useSidebar();
  const handleClick = onClick || link.onClick;

  const content = (
    <>
      <div className="shrink-0">{link.icon}</div>
      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className={cn(
          "text-neutral-700 text-sm font-medium group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0",
          active && "text-[#0D4A52] font-bold"
        )}
      >
        {link.label}
      </motion.span>
      {link.badge && open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="ml-auto"
        >
          {link.badge}
        </motion.div>
      )}
    </>
  );

  if (handleClick && !link.href) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "flex items-center justify-start gap-3 group/sidebar py-2.5 px-2 rounded-xl transition text-left w-full cursor-pointer",
          active ? "bg-[#EBF4F3] text-[#0D4A52]" : "hover:bg-neutral-100",
          className
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={link.href || "#"}
      onClick={handleClick}
      className={cn(
        "flex items-center justify-start gap-3 group/sidebar py-2.5 px-2 rounded-xl transition",
        active ? "bg-[#EBF4F3] text-[#0D4A52]" : "hover:bg-neutral-100",
        className
      )}
      {...props}
    >
      {content}
    </Link>
  );
};
