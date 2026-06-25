import Swal from "sweetalert2";

function getErrorMessage(error, fallback = "Something went wrong.") {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  return error.message || error.details || fallback;
}

function withModalPriority(config = {}) {
  const originalDidOpen = config.didOpen;

  return {
    target: document.body,
    heightAuto: false,
    ...config,
    didOpen: (popup) => {
      const container = Swal.getContainer();

      if (container) {
        container.style.zIndex = "20000";
      }

      if (typeof originalDidOpen === "function") {
        originalDidOpen(popup);
      }
    },
  };
}

export function useFeedback() {
  const toast = Swal.mixin({
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true,
  });

  const success = (title, text = "") =>
    Swal.fire(withModalPriority({
      icon: "success",
      title,
      text,
      timer: 1800,
      showConfirmButton: false,
    }));

  const error = (title = "Action failed", err, fallbackText = "") =>
    Swal.fire(withModalPriority({
      icon: "error",
      title,
      text: getErrorMessage(err, fallbackText || "Please try again."),
      confirmButtonText: "Close",
    }));

  const warning = (title, text = "") =>
    Swal.fire(withModalPriority({
      icon: "warning",
      title,
      text,
      confirmButtonText: "Close",
    }));

  const confirm = ({
    title,
    text = "",
    confirmButtonText = "Confirm",
    cancelButtonText = "Cancel",
    icon = "question",
    confirmButtonColor,
  }) =>
    Swal.fire(withModalPriority({
      title,
      text,
      icon,
      showCancelButton: true,
      confirmButtonText,
      cancelButtonText,
      ...(confirmButtonColor ? { confirmButtonColor } : {}),
    }));

  const notify = (title, icon = "success") =>
    toast.fire({
      icon,
      title,
    });

  return {
    confirm,
    error,
    notify,
    success,
    warning,
  };
}
